import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Minus, Plus } from './icons';

type Props = Omit<React.ComponentProps<'input'>, 'type' | 'min' | 'max' | 'step'> & {
  // react-hook-form передаёт min/max строкой или числом
  min?: number | string;
  max?: number | string;
  step?: number;
};

/**
 * Число с кнопками «−» и «+» по краям вместо стрелок браузера.
 * Кнопки меняют значение как ввод с клавиатуры (событие input), поэтому работает и с
 * react-hook-form (`{...register('x')}`), и с управляемым `value`/`onChange`.
 * Фокус остаётся в поле: onBlur срабатывает, когда пользователь уходит из поля, — как при наборе.
 */
function NumberInput({
  className,
  min: minProp,
  max: maxProp,
  step = 1,
  disabled,
  ref,
  ...props
}: Props) {
  const min = minProp === undefined || minProp === '' ? undefined : Number(minProp);
  const max = maxProp === undefined || maxProp === '' ? undefined : Number(maxProp);
  const inner = React.useRef<HTMLInputElement>(null);
  const setRefs = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const change = (delta: number) => {
    const el = inner.current;
    if (!el) return;
    const current = el.value === '' ? (min ?? 0) - (delta > 0 ? step : -step) : Number(el.value);
    let next = (Number.isFinite(current) ? current : (min ?? 0)) + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    // Нативный сеттер + событие input — React и react-hook-form увидят это как обычный ввод
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
      el,
      String(next),
    );
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  };

  const button = (delta: number, label: string, Icon: typeof Plus) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      // Не забираем фокус у поля: иначе onBlur сработал бы до изменения значения
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => change(delta)}
      className="flex w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-3.5" weight="bold" />
    </button>
  );

  return (
    <div
      data-slot="number-input"
      className={cn(
        'flex h-8 w-full min-w-0 overflow-hidden rounded-lg border border-input transition-colors dark:bg-input/30',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        'has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {button(-step, 'Уменьшить', Minus)}
      <input
        ref={setRefs}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        // Шаг — только для кнопок: при вводе с клавиатуры подойдёт любое число (630 кг при шаге 50)
        step="any"
        disabled={disabled}
        className="w-full min-w-0 border-x border-input bg-transparent px-1 text-center text-base tabular-nums outline-none [appearance:textfield] md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...props}
      />
      {button(step, 'Увеличить', Plus)}
    </div>
  );
}

export { NumberInput };
