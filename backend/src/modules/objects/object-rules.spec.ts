import type { StageRef } from '../../contracts/index.js';
import { combineLifts, evaluateObject, type RulesInput } from './object-rules.js';

const stages: StageRef[] = [
  { id: 's1', order: 1, shortName: 'Открытие', percent: 5 },
  { id: 's2', order: 2, shortName: 'Направляющие', percent: 40 },
  { id: 's3', order: 3, shortName: 'ПТО', percent: 80 },
  { id: 's4', order: 4, shortName: 'КС', percent: 100 },
];

const base: RulesInput = {
  stages,
  currentStageId: null,
  hasBrigade: true,
  deadline: '2026-12-31',
  openedDate: null,
  lastMarkDate: null,
  deliveryStatus: 'NOT_ORDERED',
  deliveryPlannedDate: null,
  today: '2026-11-25',
};

const codes = (input: Partial<RulesInput>) =>
  evaluateObject({ ...base, ...input }).flags.map((f) => f.code);

describe('evaluateObject', () => {
  it('без этапов: 0%, не начат, следующий — первый этап', () => {
    const r = evaluateObject(base);
    expect(r).toMatchObject({ percent: 0, state: 'NOT_STARTED', currentStage: null });
    expect(r.nextStage?.id).toBe('s1');
    expect(r.daysLeft).toBe(36);
  });

  it('процент и состояние берутся из текущего этапа', () => {
    expect(evaluateObject({ ...base, currentStageId: 's2' })).toMatchObject({
      percent: 40,
      state: 'IN_PROGRESS',
    });
    expect(evaluateObject({ ...base, currentStageId: 's3' }).state).toBe('HANDOVER');
    const done = evaluateObject({ ...base, currentStageId: 's4' });
    expect(done).toMatchObject({ percent: 100, state: 'DONE', nextStage: null });
  });

  it('нет бригады — предупреждение, но не риск', () => {
    const r = evaluateObject({ ...base, hasBrigade: false });
    expect(r.flags.map((f) => f.code)).toEqual(['NO_BRIGADE']);
    expect(r.isRisk).toBe(false);
  });

  it('просрочка', () => {
    expect(codes({ deadline: '2026-11-20' })).toContain('OVERDUE');
  });

  it('до срока ≤21 дня и готовность <80% — риск срока', () => {
    expect(codes({ deadline: '2026-12-10', currentStageId: 's2' })).toContain('DEADLINE_RISK');
    expect(codes({ deadline: '2026-12-10', currentStageId: 's3' })).not.toContain('DEADLINE_RISK');
  });

  it('отставание от линейного графика больше 20 п.п. — риск срока', () => {
    // прошло 80% срока, готовность 40%
    expect(
      codes({ openedDate: '2026-07-01', deadline: '2027-01-31', currentStageId: 's2' }),
    ).toContain('DEADLINE_RISK');
  });

  it('нет отметок 7 дней и больше', () => {
    const r = evaluateObject({ ...base, currentStageId: 's1', lastMarkDate: '2026-11-15' });
    expect(r.flags.find((f) => f.code === 'STALE')?.text).toBe('Нет отметок 10 дн.');
    expect(codes({ currentStageId: 's1', lastMarkDate: '2026-11-20' })).not.toContain('STALE');
  });

  it('поставка позже плана', () => {
    expect(codes({ deliveryStatus: 'ORDERED', deliveryPlannedDate: '2026-11-20' })).toContain(
      'DELIVERY_LATE',
    );
    expect(codes({ deliveryStatus: 'DELIVERED', deliveryPlannedDate: '2026-11-20' })).toEqual([]);
  });

  it('сданный объект не требует внимания', () => {
    expect(codes({ currentStageId: 's4', deadline: '2026-01-01', hasBrigade: false })).toEqual([]);
  });
});

describe('combineLifts', () => {
  const lift = (label: string, currentStageId: string | null, extra: Partial<RulesInput> = {}) => ({
    ...evaluateObject({ ...base, currentStageId, ...extra }),
    label,
    lastMarkDate: null,
  });

  it('один лифт — как есть', () => {
    const one = lift('', 's2');
    expect(combineLifts([one])).toBe(one);
  });

  it('процент средний, этап и состояние — по отстающему', () => {
    const r = combineLifts([lift('П1', 's3'), lift('П2', null)]);
    expect(r.percent).toBe(40);
    expect(r.state).toBe('IN_PROGRESS');
    expect(r.currentStage).toBeNull();
    expect(combineLifts([lift('П1', 's4'), lift('П2', 's3')]).state).toBe('HANDOVER');
    expect(combineLifts([lift('П1', 's4'), lift('П2', 's4')]).state).toBe('DONE');
  });

  it('флаг не у всех лифтов — с перечнем лифтов', () => {
    const r = combineLifts([lift('П1', 's1', { hasBrigade: false }), lift('П2', 's1')]);
    expect(r.flags).toEqual([{ level: 'warning', code: 'NO_BRIGADE', text: 'Нет бригады (П1)' }]);
    const all = combineLifts([
      lift('П1', 's1', { hasBrigade: false }),
      lift('П2', 's1', { hasBrigade: false }),
    ]);
    expect(all.flags[0].text).toBe('Нет бригады');
  });
});
