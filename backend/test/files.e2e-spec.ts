/**
 * Документы: принимаем только безопасные типы, отдаём так, чтобы файл не мог
 * выполнить скрипт от имени приложения.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import type { FileDto } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

const HTML = Buffer.from('<html><script>fetch("/api/users")</script></html>');
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('Документы и безопасность файлов (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let manager: Awaited<ReturnType<typeof signIn>>;
  let objectId: string;

  const upload = (
    agent: typeof manager.agent,
    name: string,
    body: Buffer,
    contentType: string,
    claimId?: string,
  ) => {
    const req = agent.post('/api/files').field('objectId', objectId).field('kind', 'DOCUMENT');
    if (claimId) req.field('claimId', claimId);
    return req.attach('file', body, { filename: name, contentType });
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    manager = await signIn(app, 'MANAGER');
    const obj = await manager.agent
      .post('/api/objects')
      .send({
        address: 'г. Иваново, ул. Файловая, 1',
        shortAddress: 'Файловая, 1',
        workType: 'REPLACEMENT',
      })
      .expect(201);
    objectId = obj.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('HTML и SVG не принимаются, даже если браузер назвал их PDF', async () => {
    await upload(manager.agent, 'page.html', HTML, 'text/html').expect(400);
    await upload(manager.agent, 'act.pdf.html', HTML, 'application/pdf').expect(400);
    await upload(manager.agent, 'logo.svg', HTML, 'image/svg+xml').expect(400);
  });

  it('PDF открывается в браузере, Word — только скачивается, оба с nosniff', async () => {
    const pdf = (await upload(manager.agent, 'Акт КС-2.pdf', PDF, 'application/pdf').expect(201))
      .body as FileDto;
    expect(pdf).toMatchObject({ kind: 'DOCUMENT', mime: 'application/pdf' });
    const pdfRes = await manager.agent.get(`/api/files/${pdf.id}`).expect(200);
    expect(pdfRes.headers['content-disposition']).toMatch(/^inline;/);
    expect(pdfRes.headers['x-content-type-options']).toBe('nosniff');

    // Браузер прислал text/html — тип всё равно берётся по расширению
    const doc = (await upload(manager.agent, 'Письмо.docx', PDF, 'text/html').expect(201))
      .body as FileDto;
    expect(doc.mime).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    const docRes = await manager.agent.get(`/api/files/${doc.id}`).expect(200);
    expect(docRes.headers['content-disposition']).toMatch(/^attachment;/);
    expect(docRes.headers['content-security-policy']).toContain('sandbox');
  });

  it('файл со старым опасным типом отдаётся только на скачивание и в sandbox', async () => {
    const doc = (await upload(manager.agent, 'old.txt', HTML, 'text/plain').expect(201))
      .body as FileDto;
    await prisma.file.update({ where: { id: doc.id }, data: { mime: 'text/html' } });
    const res = await manager.agent.get(`/api/files/${doc.id}`).expect(200);
    expect(res.headers['content-type']).toMatch(/^application\/octet-stream/);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-security-policy']).toContain('sandbox');
  });

  it('бригадир прикладывает к рекламации документ, но не HTML', async () => {
    const foreman = await signIn(app, 'FOREMAN');
    const brigade = await manager.agent
      .post('/api/brigades')
      .send({ name: `Файловая ${Date.now()}`, headcount: 2, foremanId: foreman.user.id })
      .expect(201);
    await manager.agent.patch(`/api/objects/${objectId}`).send({ brigadeId: brigade.body.id });
    const claim = await manager.agent
      .post('/api/claims')
      .send({
        objectId,
        date: '2026-11-26',
        supplier: 'ЩЛЗ',
        kind: 'DEFECT',
        description: 'Трещина',
      })
      .expect(201);
    await upload(foreman.agent, 'x.html', HTML, 'text/html', claim.body.id).expect(400);
    await upload(foreman.agent, 'Акт.pdf', PDF, 'application/pdf', claim.body.id).expect(201);
    // Без рекламации документы бригадир не загружает
    await upload(foreman.agent, 'Акт.pdf', PDF, 'application/pdf').expect(403);
  });

  it('список документов объекта', async () => {
    const docs = (
      await manager.agent
        .get(`/api/objects/${objectId}/files`)
        .query({ kind: 'DOCUMENT' })
        .expect(200)
    ).body as FileDto[];
    expect(docs.length).toBeGreaterThanOrEqual(3);
    expect(docs.every((d) => d.kind === 'DOCUMENT')).toBe(true);
  });
});
