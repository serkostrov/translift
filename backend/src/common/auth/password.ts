import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;
const KEY_LEN = 64;

/** Без похожих символов (0/o, 1/l/i): пароль диктуют по телефону или пишут на бумажке. */
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Временный пароль от администратора: три группы по четыре знака, например `k7mp-x3qa-9fde` (~59 бит). */
export function generateTempPassword(): string {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join(''),
  ).join('-');
}

/** Формат: scrypt$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}
