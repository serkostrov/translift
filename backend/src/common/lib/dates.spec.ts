import { daysBetween, endOfDayIn, startOfDayIn, todayIn } from './dates.js';

describe('dates', () => {
  it('начало и конец дня по Москве', () => {
    expect(startOfDayIn('2026-11-25', 'Europe/Moscow').toISOString()).toBe(
      '2026-11-24T21:00:00.000Z',
    );
    expect(endOfDayIn('2026-11-25', 'Europe/Moscow').toISOString()).toBe(
      '2026-11-25T21:00:00.000Z',
    );
  });

  it('«сегодня» по Москве сдвигается в 21:00 UTC', () => {
    expect(todayIn('Europe/Moscow', new Date('2026-11-25T20:59:00Z'))).toBe('2026-11-25');
    expect(todayIn('Europe/Moscow', new Date('2026-11-25T21:00:00Z'))).toBe('2026-11-26');
  });

  it('разница в днях', () => {
    expect(daysBetween('2026-11-25', '2026-12-25')).toBe(30);
  });
});
