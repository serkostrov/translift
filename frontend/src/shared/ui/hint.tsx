import type { ReactNode } from 'react';
import { HelpCircle } from '@/shared/ui/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

/**
 * Значок «?» с пояснением по нажатию — рядом с подписью поля или числа.
 * Нажатие, а не наведение: на телефоне наведения нет.
 */
export function Hint({ children, label = 'Что это' }: { children: ReactNode; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-sm leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
