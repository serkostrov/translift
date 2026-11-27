/**
 * Демо: примеры разделов поверх 11 объектов — дом с несколькими лифтами, история отметок этапов,
 * финансы (один объект в минусе) и рекламации с комментариями.
 * Каждая часть пропускается, если уже загружена, — повторный запуск ничего не дублирует.
 */
import type { PrismaClient } from '../src/generated/prisma/client.js';

export const DEMO_CONTRACT = 'ТЭ4-0520/1-2026';
const MULTI_ADDRESS = 'г. Иваново, ул. Кудряшова, д. 101';

const DAY = 86_400_000;
const day = (offset: number) => {
  const d = new Date(Date.now() + offset * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
/** Рабочее время отметки: offset дней назад, в 10–16 часов */
const at = (offset: number, hour: number) =>
  new Date(day(offset).getTime() + (hour - 3) * 3_600_000);

const MARK_COMMENTS = [
  null,
  'Демонтаж без замечаний',
  null,
  'Направляющие выставлены, отклонения в норме',
  null,
  'Оборудование принято по описи',
  null,
  'Замечаний нет',
];

export async function seedDemoExtras(prisma: PrismaClient) {
  const contract = await prisma.contract.findFirst({ where: { number: DEMO_CONTRACT } });
  if (!contract) return;
  const template = await prisma.stageTemplate.findUniqueOrThrow({
    where: { workType: 'REPLACEMENT' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  const brigades = await prisma.brigade.findMany({
    where: { foreman: { email: { in: ['brigadir1@user.ru', 'brigadir2@user.ru'] } } },
    include: { foreman: true },
  });
  const brigadeOf = (email: string) => brigades.find((b) => b.foreman?.email === email);
  const director = await prisma.user.findUnique({ where: { email: 'director@user.ru' } });
  const finance = await prisma.user.findUnique({ where: { email: 'finance@user.ru' } });

  // ---------- Дом с несколькими лифтами ----------
  if (!(await prisma.liftObject.findFirst({ where: { address: MULTI_ADDRESS } }))) {
    const stage = (n: number) => (n ? template.stages[n - 1].id : null);
    await prisma.liftObject.create({
      data: {
        address: MULTI_ADDRESS,
        shortAddress: 'Иваново, Кудряшова, 101',
        contractId: contract.id,
        brigadeId: brigadeOf('brigadir1@user.ru')?.id ?? null,
        deadline: day(95),
        lifts: {
          create: [
            {
              entrance: 'Подъезд 1',
              name: 'Пассажирский',
              position: 1,
              floors: 10,
              capacityKg: 400,
              liftInfo: 'ЩЛЗ, ПП-0411',
              templateId: template.id,
              openedDate: day(-40),
              currentStageId: stage(6),
              deliveryStatus: 'DELIVERED',
              deliveryActualDate: day(-35),
            },
            {
              entrance: 'Подъезд 1',
              name: 'Грузовой',
              position: 2,
              floors: 10,
              capacityKg: 1000,
              liftInfo: 'ЩЛЗ, ПГ-1012',
              templateId: template.id,
              // Своя бригада у грузового лифта
              brigadeId: brigadeOf('brigadir2@user.ru')?.id ?? null,
              openedDate: day(-30),
              currentStageId: stage(3),
              deliveryStatus: 'DELIVERED',
              deliveryActualDate: day(-28),
            },
            {
              entrance: 'Подъезд 2',
              position: 3,
              floors: 10,
              capacityKg: 400,
              templateId: template.id,
              currentStageId: stage(0),
              deliveryStatus: 'ORDERED',
              deliveryPlannedDate: day(12),
            },
          ],
        },
      },
    });
  }

  const objects = await prisma.liftObject.findMany({
    where: { contractId: contract.id },
    include: {
      brigade: true,
      lifts: { include: { brigade: true, currentStage: true }, orderBy: { position: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const byShort = (s: string) => objects.find((o) => o.shortAddress.includes(s));

  // ---------- История отметок этапов ----------
  for (const o of objects) {
    for (const l of o.lifts) {
      const current = l.currentStage?.order ?? 0;
      if (!current || (await prisma.stageMark.count({ where: { liftId: l.id } }))) continue;
      const authorId = (l.brigade ?? o.brigade)?.foremanId ?? director?.id;
      if (!authorId) continue;
      for (let order = 1; order <= current; order++) {
        await prisma.stageMark.create({
          data: {
            objectId: o.id,
            liftId: l.id,
            stageId: template.stages[order - 1].id,
            // Последний этап — пару дней назад, предыдущие — раньше, с шагом в неделю
            performedAt: at(-2 - (current - order) * 7, 10 + (order % 6)),
            authorId,
            comment: MARK_COMMENTS[order % MARK_COMMENTS.length],
          },
        });
      }
    }
  }

  // ---------- Финансы ----------
  // [объект, сумма договора, доп. соглашения, платежи, расходы: [статья, название, сумма, дней назад]]
  type Fin = [
    string,
    number,
    [string, number][],
    number[],
    ['EQUIPMENT' | 'WORKS' | 'OTHER', string, number, number][],
  ];
  const FINANCES: Fin[] = [
    [
      'Кудряшова, 101',
      9_600_000,
      [['Доп. соглашение № 1: замена дверей шахты грузового лифта', 420_000]],
      [2_880_000, 2_000_000],
      [
        ['EQUIPMENT', 'Оборудование ЩЛЗ, 3 лифта', 6_150_000, 60],
        ['WORKS', 'Монтаж, бригада Смирнова — аванс', 450_000, 30],
        ['OTHER', 'Доставка оборудования', 85_000, 35],
      ],
    ],
    [
      'Лежневская, 158, п. 1',
      3_150_000,
      [],
      [945_000, 1_200_000],
      [
        ['EQUIPMENT', 'Лифт ЩЛЗ ПП-0411', 2_050_000, 50],
        ['WORKS', 'Монтаж, бригада', 310_000, 10],
      ],
    ],
    [
      'Хлебникова, 40',
      3_200_000,
      [['Доп. соглашение № 1: уменьшение объёма работ', -120_000]],
      [960_000],
      [
        ['EQUIPMENT', 'Лифт ЩЛЗ ПП-0411', 2_100_000, 45],
        ['WORKS', 'Монтаж, бригада', 380_000, 15],
        ['WORKS', 'Демонтаж старого лифта, подрядчик', 290_000, 40],
        ['OTHER', 'Перемонтаж после брака оборудования', 470_000, 7],
      ],
    ],
  ];
  for (const [short, amount, agreements, payments, expenses] of FINANCES) {
    const o = byShort(short);
    if (!o || (await prisma.objectFinance.findUnique({ where: { objectId: o.id } }))) continue;
    await prisma.objectFinance.create({ data: { objectId: o.id, contractAmount: amount } });
    const authorId = finance?.id ?? null;
    await prisma.financeEntry.createMany({
      data: [
        ...agreements.map(([title, sum], i) => ({
          objectId: o.id,
          type: 'AGREEMENT' as const,
          title,
          amount: sum,
          date: day(-20 + i),
          authorId,
        })),
        ...payments.map((sum, i) => ({
          objectId: o.id,
          type: 'PAYMENT' as const,
          title: i === 0 ? 'Аванс 30%' : `Оплата по счёту № ${14 + i}`,
          amount: sum,
          date: day(-55 + i * 25),
          authorId,
        })),
        ...expenses.map(([kind, title, sum, ago]) => ({
          objectId: o.id,
          type: 'EXPENSE' as const,
          kind,
          title,
          amount: sum,
          date: day(-ago),
          authorId,
        })),
      ],
    });
    const total = amount + agreements.reduce((s, [, v]) => s + v, 0);
    const spent = expenses.reduce((s, [, , v]) => s + v, 0);
    if (spent > total) {
      await prisma.notification.create({
        data: {
          objectId: o.id,
          link: `/objects/${o.id}`,
          level: 'DANGER',
          topic: 'Объект в минусе',
          text: `${o.shortAddress}: расходы превысили сумму для заказчика на ${(spent - total).toLocaleString('ru-RU')} ₽`,
        },
      });
    }
  }

  // ---------- Рекламации ----------
  const ids = objects.map((o) => o.id);
  if (!(await prisma.claim.count({ where: { objectId: { in: ids } } }))) {
    // [объект, лифт (позиция), поставщик, вид, описание, статус, дней назад, комментарии [автор, текст]]
    type ClaimSeed = [
      string,
      number | null,
      string,
      'DEFECT' | 'INCOMPLETE' | 'MISMATCH',
      string,
      'NEW' | 'IN_REVIEW' | 'ACCEPTED' | 'RESOLVED',
      number,
      ['foreman' | 'director', string][],
    ];
    const CLAIMS: ClaimSeed[] = [
      [
        'Кудряшова, 101',
        2,
        'ЩЛЗ',
        'INCOMPLETE',
        'Не хватает двух кронштейнов направляющих кабины и комплекта крепежа',
        'IN_REVIEW',
        20,
        [
          ['foreman', 'Обнаружили при раскладке оборудования, фото приложу'],
          ['director', 'Письмо в ЩЛЗ отправил, обещают досылку на следующей неделе'],
        ],
      ],
      [
        'Хлебникова, 40',
        null,
        'ЩЛЗ',
        'DEFECT',
        'Трещина на корпусе станции управления, при включении ошибка E12',
        'ACCEPTED',
        30,
        [
          ['foreman', 'Станцию не включаем до замены'],
          ['director', 'Завод признал брак, замена за их счёт'],
          ['foreman', 'Новую станцию привезли, ставим'],
        ],
      ],
      [
        'Лежневская, 158, п. 1',
        null,
        'Могилевлифтмаш',
        'MISMATCH',
        'Двери шахты пришли с другим проёмом: 800 мм вместо 700 мм по проекту',
        'NEW',
        3,
        [['foreman', 'Монтаж дверей приостановили, ждём решения']],
      ],
      [
        'Кудряшова, 101',
        1,
        'ЩЛЗ',
        'DEFECT',
        'Царапины на панелях кабины',
        'RESOLVED',
        28,
        [['director', 'Панели заменены по гарантии']],
      ],
    ];
    for (const [short, pos, supplier, kind, description, status, ago, comments] of CLAIMS) {
      const o = byShort(short);
      if (!o) continue;
      const lift = pos === null ? null : o.lifts.find((l) => l.position === pos);
      const foremanId = (lift?.brigade ?? o.brigade)?.foremanId ?? director?.id;
      await prisma.claim.create({
        data: {
          objectId: o.id,
          liftId: o.lifts.length > 1 ? (lift?.id ?? null) : null,
          date: day(-ago),
          supplier,
          kind,
          description,
          status,
          comments: {
            create: comments
              .map(([who, text], i) => ({
                authorId: (who === 'foreman' ? foremanId : director?.id) as string,
                text,
                createdAt: at(-ago + i * 3, 11 + i),
              }))
              .filter((c) => c.authorId),
          },
        },
      });
    }
  }

  console.warn('Демо: дом с тремя лифтами, история отметок, финансы, рекламации');
}
