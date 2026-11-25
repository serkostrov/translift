/** Даты без времени хранятся в Postgres как `date` и приходят в Prisma как UTC-полночь. */

export function toDateString(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** `YYYY-MM-DD` → Date (UTC-полночь); null/undefined сохраняются как есть. */
export function fromDateString<T extends string | null | undefined>(
  s: T,
): T extends string ? Date : T {
  return (typeof s === 'string' ? new Date(`${s}T00:00:00Z`) : s) as never;
}

/** Сегодняшняя дата в часовом поясе заказчика, `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Дата момента времени в часовом поясе заказчика. */
export const dateIn = todayIn;

/** Сколько дней от `from` до `to` (обе `YYYY-MM-DD`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Смещение часового пояса в минутах для момента времени (например, +180 для Москвы). */
function tzOffsetMinutes(timeZone: string, at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = part?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Начало дня `YYYY-MM-DD` в часовом поясе заказчика как момент времени. */
export function startOfDayIn(date: string, timeZone: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - tzOffsetMinutes(timeZone, utcMidnight) * 60_000);
}

/** Конец дня (начало следующего) `YYYY-MM-DD` в часовом поясе заказчика. */
export function endOfDayIn(date: string, timeZone: string): Date {
  return new Date(startOfDayIn(date, timeZone).getTime() + 86_400_000);
}

/**
 * Момент времени, сдвинутый в часовой пояс заказчика — для ячеек Excel:
 * ExcelJS пишет даты как UTC, без сдвига 15:47 МСК превратилось бы в 12:47.
 */
export function shiftToZone(at: Date, timeZone: string): Date {
  return new Date(at.getTime() + tzOffsetMinutes(timeZone, at) * 60_000);
}
