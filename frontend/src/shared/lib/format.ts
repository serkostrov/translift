const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` или ISO → `ДД.ММ.ГГГГ`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  const d = new Date(value);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** plural(5, 'объект', 'объекта', 'объектов') → 'объектов' */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function formatDaysLeft(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return `просрочен на ${-days} ${plural(-days, 'день', 'дня', 'дней')}`;
  return `осталось ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}
