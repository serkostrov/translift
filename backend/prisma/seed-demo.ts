/**
 * Демо-данные из HTML-прототипа: бригады с бригадирами, договор, 11 объектов.
 * Только для локальной разработки и показа. Повторный запуск ничего не дублирует.
 * Пароль бригадиров — SEED_DEMO_PASSWORD из .env.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/auth/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY = 86_400_000;
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const BRIGADES = [
  { name: 'Бригада Смирнова', login: 'smirnov', fullName: 'Алексей Смирнов', headcount: 3 },
  { name: 'Бригада Козлова', login: 'kozlov', fullName: 'Игорь Козлов', headcount: 3 },
  { name: 'Бригада Волкова', login: 'volkov', fullName: 'Павел Волков', headcount: 2 },
  { name: 'Бригада Зайцева', login: 'zaitsev', fullName: 'Николай Зайцев', headcount: 3 },
];

// [полный адрес, короткий, этажность, г/п, срок (дн. от сегодня), открыт (дн.), бригада (индекс), этап]
type Row = [string, string, number, number, number, number | null, number | null, number];
const OBJECTS: Row[] = [
  [
    '155841, Ивановская обл., Кинешемский р-н, д. Дьячево, мкр Санаторий Решма, д. 1',
    'Решма, мкр Санаторий Решма, д. 1',
    9,
    400,
    75,
    null,
    null,
    0,
  ],
  [
    'г. Иваново, ул. Лежневская, д. 158, подъезд 1',
    'Иваново, Лежневская, 158, п. 1',
    9,
    400,
    40,
    -34,
    0,
    7,
  ],
  [
    'г. Иваново, ул. Лежневская, д. 158, подъезд 2',
    'Иваново, Лежневская, 158, п. 2',
    9,
    400,
    40,
    -20,
    0,
    4,
  ],
  ['г. Кинешма, ул. Вичугская, д. 140', 'Кинешма, Вичугская, 140', 9, 400, 12, -52, 1, 11],
  ['г. Шуя, ул. Свердлова, д. 98', 'Шуя, Свердлова, 98', 9, 320, 18, -30, 2, 2],
  ['г. Вичуга, ул. 50 лет Октября, д. 12', 'Вичуга, 50 лет Октября, 12', 9, 400, 20, -60, 3, 12],
  ['г. Тейково, ул. Октябрьская, д. 33', 'Тейково, Октябрьская, 33', 10, 630, 9, -70, 1, 13],
  [
    'г. Иваново, пр-т Строителей, д. 94, подъезд 3',
    'Иваново, пр-т Строителей, 94, п. 3',
    12,
    400,
    -4,
    -88,
    0,
    14,
  ],
  ['г. Кохма, ул. Кочетовой, д. 51', 'Кохма, Кочетовой, 51', 9, 400, 30, -41, 3, 9],
  [
    'г. Фурманов, ул. Социалистическая, д. 15',
    'Фурманов, Социалистическая, 15',
    9,
    320,
    70,
    -5,
    2,
    1,
  ],
  ['г. Иваново, ул. Генерала Хлебникова, д. 40', 'Иваново, Хлебникова, 40', 9, 400, 45, -25, 3, 6],
];

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error('Задайте SEED_DEMO_PASSWORD в .env');
  if (await prisma.liftObject.count()) {
    console.warn('Объекты уже есть — демо-данные не загружаются');
    return;
  }
  const passwordHash = await hashPassword(password);

  const brigades = [];
  for (const b of BRIGADES) {
    const foreman = await prisma.user.upsert({
      where: { login: b.login },
      update: {},
      create: { login: b.login, fullName: b.fullName, role: 'FOREMAN', passwordHash },
    });
    brigades.push(
      await prisma.brigade.upsert({
        where: { foremanId: foreman.id },
        update: {},
        create: { name: b.name, headcount: b.headcount, foremanId: foreman.id },
      }),
    );
  }

  const customer = await prisma.customer.create({ data: { name: 'ООО «Трансэнерго»' } });
  const contract = await prisma.contract.create({
    data: {
      customerId: customer.id,
      number: 'ТЭ4-0520/1-2026',
      date: new Date('2026-05-20'),
      responsible: 'Кондратьева Вера Анатольевна',
    },
  });

  const template = await prisma.stageTemplate.findUniqueOrThrow({
    where: { workType: 'REPLACEMENT' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });

  for (const [
    address,
    shortAddress,
    floors,
    capacityKg,
    deadline,
    opened,
    brigade,
    stage,
  ] of OBJECTS) {
    await prisma.liftObject.create({
      data: {
        address,
        shortAddress,
        floors,
        capacityKg,
        templateId: template.id,
        contractId: contract.id,
        brigadeId: brigade === null ? null : brigades[brigade].id,
        deadline: day(deadline),
        openedDate: opened === null ? null : day(opened),
        currentStageId: stage ? template.stages[stage - 1].id : null,
        deliveryStatus: stage ? 'DELIVERED' : 'NOT_ORDERED',
      },
    });
  }
  console.warn(`Демо: ${BRIGADES.length} бригады, ${OBJECTS.length} объектов`);
}

await main();
await prisma.$disconnect();
