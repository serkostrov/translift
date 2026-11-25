/**
 * Начальные данные: шаблоны этапов и первый администратор.
 * Повторный запуск безопасен (upsert).
 * TODO(заказчик): шаблон «Монтаж в новостройке» — пока копия шаблона замены.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/auth/password.js';
import { type ControlDate, PrismaClient, type WorkType } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type StageSeed = [fullName: string, shortName: string, percent: number, setsDate?: ControlDate];

/** Этапы замены лифта — из таблицы заказчика (демоверсия). */
const REPLACEMENT_STAGES: StageSeed[] = [
  ['Открытие объекта, вывоз оборудования на объект', 'Открытие объекта', 5],
  ['Демонтаж-монтаж направляющих', 'Направляющие', 10],
  ['Демонтаж-монтаж дверей шахты', 'Двери шахты', 20],
  ['Демонтаж-монтаж кабины', 'Кабина', 25],
  ['Демонтаж-монтаж противовеса', 'Противовес', 30],
  ['Демонтаж-монтаж лебедки, ОС', 'Лебёдка, ОС', 40],
  [
    'Установка станции, ВУ, ПЧ, подключение электрики лифта по шахте и МП',
    'Станция, ВУ, ПЧ, электрика',
    50,
  ],
  ['Пусконаладочные работы', 'Пусконаладка', 60],
  ['Запуск в нормальную работу, регулировка Т.О.', 'Запуск, регулировка', 65],
  ['Электротехнические работы по шахте и МП', 'Электротехника по шахте и МП', 70],
  ['Строительно-отделочные работы', 'Строительно-отделочные работы', 75],
  ['ПТО, декларирование', 'ПТО, декларирование', 80, 'PTO'],
  ['Проведение комиссионной приемки', 'Комиссионная приёмка', 90, 'ACCEPTANCE'],
  ['Подписание актов, КС-2, КС-3', 'Акты, КС-2, КС-3', 100, 'KS'],
];

const TEMPLATES: { workType: WorkType; name: string; stages: StageSeed[] }[] = [
  {
    workType: 'REPLACEMENT',
    name: 'Замена лифта в действующем здании',
    stages: REPLACEMENT_STAGES,
  },
  { workType: 'NEW_BUILDING', name: 'Монтаж в новостройке', stages: REPLACEMENT_STAGES },
];

async function seedTemplates() {
  for (const t of TEMPLATES) {
    const template = await prisma.stageTemplate.upsert({
      where: { workType: t.workType },
      update: {},
      create: { workType: t.workType, name: t.name },
    });
    for (const [i, [fullName, shortName, percent, setsDate]] of t.stages.entries()) {
      await prisma.templateStage.upsert({
        where: { templateId_order: { templateId: template.id, order: i + 1 } },
        update: {},
        create: { templateId: template.id, order: i + 1, fullName, shortName, percent, setsDate },
      });
    }
  }
}

async function seedAdmin() {
  const login = process.env.SEED_ADMIN_LOGIN;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!login || !password) return;
  await prisma.user.upsert({
    where: { login },
    update: {},
    create: {
      login,
      passwordHash: await hashPassword(password),
      fullName: 'Администратор',
      role: 'ADMIN',
    },
  });
}

await seedTemplates();
await seedAdmin();
await prisma.$disconnect();
console.warn('Seed: шаблоны этапов и администратор готовы');
