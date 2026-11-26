import { useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { Loader2 } from '@/shared/ui/icons';

export type Paging = {
  /** Есть что догрузить */
  hasMore: boolean;
  /** Идёт загрузка следующей порции */
  loading: boolean;
  onMore: () => void;
  /** Показано записей и сколько всего */
  shown: number;
  total: number;
};

/**
 * Конец списка: когда он доезжает до экрана, догружается следующая порция.
 * Пока грузится — «Загружаем ещё…», если автодогрузка не сработала — кнопка,
 * когда всё загружено — «Показаны все N».
 */
export function InfiniteFooter({ hasMore, loading, onMore, shown, total }: Paging) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  more.current = onMore;

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    // Запас 300px: следующая порция приходит до того, как список кончится
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && more.current(),
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  if (!total) return null;
  return (
    <div
      ref={ref}
      className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground"
      aria-live="polite"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Загружаем ещё…
        </span>
      ) : hasMore ? (
        <Button variant="outline" size="sm" onClick={onMore}>
          Показать ещё
        </Button>
      ) : null}
      <span className="tabular-nums">
        {hasMore ? `Показано ${shown} из ${total}` : `Показаны все: ${total}`}
      </span>
    </div>
  );
}
