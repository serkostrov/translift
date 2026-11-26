import { formatPhoneDigits, phoneDigits } from '@contracts';
import { type ComponentProps, type KeyboardEvent, useLayoutEffect, useRef } from 'react';
import { Input } from '@/shared/ui/input';

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string | null | undefined;
  onChange: (value: string) => void;
};

const isDigit = (c: string | undefined) => !!c && c >= '0' && c <= '9';

/** Позиция в строке сразу после n-й цифры (n = 0 — после «+7 », если он есть). */
function caretAfterDigits(formatted: string, n: number): number {
  if (n === 0) return formatted.startsWith('+7') ? Math.min(3, formatted.length) : 1;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (isDigit(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
}

/**
 * Телефон с маской `+7 900 123-45-67`. «8 900…», «7 900…» и «900…» сразу становятся «+7 900…»,
 * вставка из буфера в любом виде тоже. Курсор не прыгает при правке в середине,
 * Backspace перескакивает пробелы и дефисы. Значение формы — то, что видно в поле;
 * в E.164 его приводит схема.
 */
export function PhoneInput({ value, onChange, onKeyDown, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const shown = value ? formatPhoneDigits(phoneDigits(value)) : '';

  // Курсор ставим после того, как React записал новое значение
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current === document.activeElement) {
      ref.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  /** Применить набранное: raw — новый текст, digitsBeforeCaret — цифр левее курсора в raw. */
  const apply = (raw: string, digitsBeforeCaret: number) => {
    if (raw.trim() === '+') {
      onChange('+');
      return;
    }
    const before = raw.replace(/\D/g, '').length;
    const digits = phoneDigits(raw);
    // «9…» без плюса получает спереди 7 — курсор сдвигается на цифру
    const shift = digits.length > before && !raw.trim().startsWith('+') ? 1 : 0;
    const formatted = formatPhoneDigits(digits);
    caret.current = caretAfterDigits(formatted, Math.min(digitsBeforeCaret + shift, digits.length));
    onChange(formatted);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    const el = e.currentTarget;
    const pos = el.selectionStart ?? 0;
    if (e.key !== 'Backspace' || pos !== el.selectionEnd || pos === 0) return;
    if (isDigit(el.value[pos - 1])) return;
    // Слева разделитель: стираем ближайшую цифру перед ним, а не пробел, который маска вернёт
    e.preventDefault();
    let j = pos - 1;
    while (j >= 0 && !isDigit(el.value[j])) j--;
    if (j < 0) return;
    const raw = el.value.slice(0, j) + el.value.slice(j + 1);
    apply(raw, raw.slice(0, j).replace(/\D/g, '').length);
  };

  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+7 900 123-45-67"
      {...props}
      value={shown}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const raw = e.target.value;
        const pos = e.target.selectionStart ?? raw.length;
        apply(raw, raw.slice(0, pos).replace(/\D/g, '').length);
      }}
    />
  );
}
