import { formatPhone, formatPhoneDigits, normalizePhone, phoneDigits } from './common.js';

const typed = (raw: string) => formatPhoneDigits(phoneDigits(raw));

describe('Телефон: маска и приведение', () => {
  it('8, 7 и 9 в начале без плюса — российский номер +7', () => {
    expect(typed('8')).toBe('+7');
    expect(typed('8 999')).toBe('+7 999');
    expect(typed('89991234567')).toBe('+7 999 123-45-67');
    expect(typed('7 999 123')).toBe('+7 999 123');
    expect(typed('999')).toBe('+7 999');
    expect(typed('9991234567')).toBe('+7 999 123-45-67');
  });

  it('маска по мере набора и лишние цифры отбрасываются', () => {
    expect(typed('+7999123')).toBe('+7 999 123');
    expect(typed('+79991234')).toBe('+7 999 123-4');
    expect(typed('+7 (999) 123-45-67 89')).toBe('+7 999 123-45-67');
  });

  it('другие страны — как набрали, с плюсом', () => {
    expect(typed('+375291234567')).toMatch(/^\+375 /);
  });

  it('в базу — E.164, на экран — маска', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toBe('+79991234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(formatPhone('+79991234567')).toBe('+7 999 123-45-67');
  });
});
