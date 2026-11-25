import { useId } from 'react';
import { cn } from '@/shared/lib/utils';

/** Знак «Транслифт»: строгая голубая «Т» на стальном блоке, шов на ножке — стык дверей кабины. Тот же рисунок, что в public/logo.svg. */
export function LogoMark({ className }: { className?: string }) {
  // id градиента уникален: знак может стоять на странице несколько раз
  const gradientId = `steel-${useId()}`;
  return (
    <svg viewBox="0 0 512 512" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--brand-steel)" />
          <stop offset="1" stopColor="var(--brand-ink)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill={`url(#${gradientId})`} />
      <rect x="104" y="112" width="304" height="72" rx="6" fill="var(--brand)" />
      <rect x="210" y="184" width="92" height="216" fill="var(--brand)" />
      <rect x="252" y="204" width="8" height="176" fill="#3A4452" />
      <rect x="176" y="400" width="160" height="16" rx="3" fill="#9AA6B4" />
    </svg>
  );
}

/** Знак + название: для бокового меню и страницы входа. */
export function Logo({ subtitle = true, className }: { subtitle?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="size-9 shrink-0" />
      <div className="leading-tight">
        <div className="font-semibold">Транслифт</div>
        {subtitle && <div className="text-xs text-muted-foreground">Контроль монтажа лифтов</div>}
      </div>
    </div>
  );
}
