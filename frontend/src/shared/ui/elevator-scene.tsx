import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

type Props = {
  /** Что на табло над дверями */
  display: string;
  /** Кабина застряла между этажами (страница ошибки) */
  stuck?: boolean;
  title: string;
  text: ReactNode;
  actions: ReactNode;
};

/** Иллюстрация для страниц 404 и ошибки: шахта с кабиной и табло этажа. */
export function ElevatorScene({ display, stuck, title, text, actions }: Props) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 px-4 py-10 text-center sm:flex-row sm:text-left">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div className="rounded-md bg-brand-ink px-4 py-1.5 font-mono text-2xl tracking-widest text-brand shadow-inner">
          {display}
        </div>
        <div className="relative h-56 w-32 rounded-lg border-4 border-muted-foreground/30 bg-muted/40">
          {/* этажные перекрытия */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute inset-x-0 h-0.5 bg-muted-foreground/20"
              style={{ top: `${i * 25}%` }}
            />
          ))}
          <div
            className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground/30"
            style={{ height: stuck ? '38%' : '18%' }}
          />
          <div
            className={cn(
              'absolute inset-x-6 h-[30%] rounded-md bg-brand shadow-md',
              stuck && 'motion-safe:animate-[elevator-shake_2.4s_ease-in-out_infinite]',
            )}
            style={{ top: stuck ? '38%' : '18%' }}
          >
            <div className="absolute inset-y-1.5 left-1.5 right-[calc(50%+1px)] rounded-sm bg-brand-ink/85" />
            <div className="absolute inset-y-1.5 right-1.5 left-[calc(50%+1px)] rounded-sm bg-brand-ink/85" />
          </div>
        </div>
      </div>
      <div className="max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="text-muted-foreground">{text}</div>
        <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">{actions}</div>
      </div>
    </div>
  );
}
