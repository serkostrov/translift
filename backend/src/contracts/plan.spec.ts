import { planControlDates, planLifts, planStages } from './objects.js';

const stages = [
  { id: 'b', order: 2, plannedDays: 5, setsDate: 'PTO' as const },
  { id: 'a', order: 1, plannedDays: 2, setsDate: null },
  { id: 'c', order: 3, plannedDays: 10, setsDate: 'ACCEPTANCE' as const },
];

describe('план этапов', () => {
  it('этап заканчивается через сумму дней до него включительно, по порядку', () => {
    const plan = planStages(stages, '2026-12-30');
    expect(Object.fromEntries(plan)).toEqual({ a: '2027-01-01', b: '2027-01-06', c: '2027-01-16' });
  });

  it('без даты начала плана нет', () => {
    expect(planStages(stages, null).size).toBe(0);
  });

  it('контрольные даты — от этапа, который их ставит', () => {
    const plan = planStages(stages, '2026-12-30');
    expect(planControlDates(stages, plan)).toEqual({
      ptoDate: '2027-01-06',
      declarationDate: '2027-01-06',
      acceptanceDate: '2027-01-16',
      commissionedDate: '2027-01-16',
    });
  });
});

describe('planLifts', () => {
  it('один лифт с названием — как есть', () => {
    expect(planLifts('Грузовой', 1, [{ id: 'a', name: '' }])).toEqual({
      names: ['Грузовой'],
      renames: [],
    });
  });
  it('первый лифт подъезда без названия — без подписи', () => {
    expect(planLifts('', 1, [])).toEqual({ names: [''], renames: [] });
  });
  it('без названия: нумерация, безымянный лифт подъезда становится «Лифт 1»', () => {
    expect(planLifts('', 2, [{ id: 'a', name: '' }])).toEqual({
      names: ['Лифт 2', 'Лифт 3'],
      renames: [{ id: 'a', name: 'Лифт 1' }],
    });
    expect(planLifts('', 1, [{ id: 'a', name: 'Лифт 1' }]).names).toEqual(['Лифт 2']);
  });
  it('несколько с названием — с номерами, продолжая занятые', () => {
    expect(planLifts('Грузовой', 2, [{ id: 'a', name: 'Грузовой 1' }]).names).toEqual([
      'Грузовой 2',
      'Грузовой 3',
    ]);
  });
});
