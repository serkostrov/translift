import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/utils';

/** Высота одного этажа на картинке, px */
const FLOOR_H = 44;
/** Сколько длится проезд одного этажа, мс — совпадает с анимацией фона */
const FLOOR_MS = 650;
/** После этого этажа табло начинает заново с первого */
const TOP_FLOOR = 16;
/** Этажей в ленте: окно шахты + запас на прокрутку */
const STRIP = 5;

/**
 * Лоадер «едущий лифт»: кабина стоит на месте, а за ней вниз проезжают этажи
 * (перекрытия и двери шахты) — ощущение, что лифт едет вверх. Табло считает этажи
 * в такт. Лента бесконечная: сдвигается ровно на один этаж и начинается заново.
 * При «уменьшить движение» всё стоит.
 */
export function ElevatorLoader({
  label = 'Загружаем…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [floor, setFloor] = useState(1);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setFloor((f) => (f >= TOP_FLOOR ? 1 : f + 1)), FLOOR_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3 py-10', className)}
    >
      {/* табло */}
      <div className="flex items-center gap-1.5 rounded-md bg-brand-ink px-2.5 py-1 font-mono text-sm text-brand tabular-nums shadow-inner">
        <span aria-hidden="true">▲</span>
        <span className="w-5 text-center">{floor}</span>
      </div>

      {/* шахта: окно, в котором едут этажи */}
      <div
        className="relative w-20 overflow-hidden rounded-md border-2 border-muted-foreground/30 bg-muted/40"
        style={{ height: FLOOR_H * 3 }}
      >
        {/* лента этажей */}
        <div
          className="absolute inset-x-0 motion-safe:animate-[elevator-floors_linear_infinite]"
          style={{
            top: -FLOOR_H,
            animationDuration: `${FLOOR_MS}ms`,
            ['--floor-h' as string]: `${FLOOR_H}px`,
          }}
        >
          {Array.from({ length: STRIP }, (_, i) => (
            <div
              key={i}
              className="relative border-b-2 border-muted-foreground/35"
              style={{ height: FLOOR_H }}
            >
              {/* двери шахты на этаже — по краям, за кабиной */}
              <div className="absolute bottom-0 left-1 h-7 w-2.5 rounded-t-[2px] border border-b-0 border-muted-foreground/40 bg-muted-foreground/10" />
              <div className="absolute right-1 bottom-0 h-7 w-2.5 rounded-t-[2px] border border-b-0 border-muted-foreground/40 bg-muted-foreground/10" />
            </div>
          ))}
        </div>

        {/* трос */}
        <div
          className="absolute top-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/60"
          style={{ height: FLOOR_H - 4 }}
        />
        {/* кабина — неподвижна, лишь едва заметно подрагивает */}
        <div
          className="absolute left-1/2 h-9 w-10 -translate-x-1/2 rounded-[4px] bg-brand shadow-md motion-safe:animate-[elevator-hum_1.3s_ease-in-out_infinite]"
          style={{ top: FLOOR_H - 4 }}
        >
          <div className="absolute inset-y-1 left-1 right-[calc(50%+1px)] rounded-[1px] bg-brand-ink/80" />
          <div className="absolute inset-y-1 right-1 left-[calc(50%+1px)] rounded-[1px] bg-brand-ink/80" />
        </div>

        {/* затемнение сверху и снизу — этажи «уходят» за край */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-background/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background/70 to-transparent" />
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
