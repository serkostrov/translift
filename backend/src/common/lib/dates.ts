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
