/** Карточки договора и заказчика: объекты списком (с архивными) и деньги по ним. */
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ContractDetails, CustomerDetails, CustomerListItem } from '../src/contracts/index.js';
import { createTestApp, signIn } from './helpers.js';

describe('Договоры и заказчики (e2e)', () => {
  let app: NestExpressApplication;
  let admin: Awaited<ReturnType<typeof signIn>>;
  let customerId: string;
  let contractId: string;
  const objectIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await createTestApp());
    admin = await signIn(app, 'ADMIN');
    const customer = await admin.agent
      .post('/api/customers')
      .send({ name: `Фонд ${Date.now()}`, inn: '3702000000' })
      .expect(201);
    customerId = customer.body.id;
    const contract = await admin.agent
      .post('/api/contracts')
      .send({ customerId, number: `Д-${Date.now()}` })
      .expect(201);
    contractId = contract.body.id;
    for (const [i, amount] of [1_000_000, 500_000].entries()) {
      const o = await admin.agent
        .post('/api/objects')
        .send({
          address: `г. Тест, ул. Договорная, ${i + 1}`,
          shortAddress: `Договорная, ${i + 1}`,
          workType: 'REPLACEMENT',
          contractId,
        })
        .expect(201);
      objectIds.push(o.body.id);
      await admin.agent
        .put(`/api/objects/${o.body.id}/finance`)
        .send({ contractAmount: amount })
        .expect(200);
      await admin.agent
        .post(`/api/objects/${o.body.id}/finance/entries`)
        .send({ type: 'PAYMENT', title: 'Аванс', amount: amount / 4, date: '2026-11-01' })
        .expect(201);
    }
    // Второй объект — в архиве: в карточке договора он всё равно есть
    await admin.agent.patch(`/api/objects/${objectIds[1]}`).send({ archived: true }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('договор: все объекты и суммы по деньгам', async () => {
    const c = (await admin.agent.get(`/api/contracts/${contractId}`).expect(200))
      .body as ContractDetails;
    expect(c.objects.map((o) => o.id).sort()).toEqual([...objectIds].sort());
    expect(c.objects.find((o) => o.id === objectIds[1])?.archived).toBe(true);
    expect(c.money).toMatchObject({
      withFinance: 2,
      contractAmount: 1_500_000,
      paidAmount: 375_000,
      debt: 1_125_000,
    });
  });

  it('заказчик: договоры, объекты, деньги; в списке — счётчики', async () => {
    const c = (await admin.agent.get(`/api/customers/${customerId}`).expect(200))
      .body as CustomerDetails;
    expect(c.contracts.map((k) => k.id)).toEqual([contractId]);
    expect(c.objects).toHaveLength(2);
    expect(c.money?.contractAmount).toBe(1_500_000);

    const list = (await admin.agent.get('/api/customers').expect(200)).body as CustomerListItem[];
    expect(list.find((x) => x.id === customerId)).toMatchObject({
      contractsCount: 1,
      objectsCount: 2,
    });
  });

  it('руководитель видит деньги, бригадир карточки не видит', async () => {
    const manager = await signIn(app, 'MANAGER');
    const c = (await manager.agent.get(`/api/contracts/${contractId}`).expect(200))
      .body as ContractDetails;
    expect(c.money).not.toBeNull();
    const foreman = await signIn(app, 'FOREMAN');
    await foreman.agent.get(`/api/contracts/${contractId}`).expect(403);
    await foreman.agent.get(`/api/customers/${customerId}`).expect(403);
  });
});
