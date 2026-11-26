/**
 * Контракты API: схемы Zod и типы, общие для backend и frontend.
 * Здесь нельзя импортировать Nest, Prisma и Node API — файлы собирает и Vite.
 */
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { z } from 'zod';

export const ROLES = ['ADMIN', 'MANAGER', 'FOREMAN', 'FINANCE'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  FOREMAN: 'Бригадир',
  FINANCE: 'Финансы',
};

export const idSchema = z.uuid();

/** Дата без времени: `YYYY-MM-DD`. */
export const dateSchema = z.iso.date();
export type DateString = string;

/** Пустая строка из формы → null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const requiredText = (max = 500) => z.string().trim().min(1, 'Обязательное поле').max(max);

export type Option = { id: string; name: string };

// ---------- Почта и телефон ----------

/** Телефон в любом виде («8 900 123-45-67», «+7 (900) 1234567») → E.164 `+79001234567`; null — не номер. */
export function normalizePhone(value: string): string | null {
  const p = parsePhoneNumberFromString(value.trim(), 'RU');
  return p?.isValid() ? p.number : null;
}

/**
 * Цифры номера с кодом страны из того, что набрали: «8 900…» и «900…» без плюса — это Россия,
 * поэтому превращаются в «7900…». С плюсом — как набрали. Российский номер — не длиннее 11 цифр.
 */
export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (!raw.trim().startsWith('+')) {
    if (d.startsWith('8')) d = `7${d.slice(1)}`;
    else if (d.startsWith('9')) d = `7${d}`;
  }
  return d.startsWith('7') ? d.slice(0, 11) : d.slice(0, 15);
}

/** Маска по мере набора: `+7 900 123-45-67`; другие страны — по правилам libphonenumber. */
export function formatPhoneDigits(d: string): string {
  if (!d) return '';
  if (d.startsWith('7')) {
    const parts = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = '+7';
    parts.forEach((p, i) => {
      if (p) out += (i < 2 ? ' ' : '-') + p;
    });
    return out;
  }
  return new AsYouType().input(`+${d}`);
}

/** `+79001234567` → `+7 900 123-45-67` для показа. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  return formatPhoneDigits(phoneDigits(value));
}

const PHONE_ERROR = 'Неверный номер, например +7 900 123-45-67';

/** Обязательный телефон (вход по телефону): на выходе E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Введите телефон')
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR });
      return z.NEVER;
    }
    return phone;
  });

/** Телефон в форме: пусто → null, иначе E.164. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR });
      return z.NEVER;
    }
    return phone;
  })
  .nullable()
  .optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Введите почту')
  .max(200)
  .pipe(z.email('Неверный адрес почты, например ivanov@mail.ru'));

/** Почта в форме: пусто → null. */
export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();
