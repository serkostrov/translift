/**
 * Скелетоны по форме настоящего содержимого: пока данные грузятся, страница
 * уже стоит на месте и не прыгает, когда они приходят.
 */
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Список: строки таблицы на десктопе, карточки на телефоне (как DataList). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true">
      <Card className="hidden gap-0 py-0 md:block">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-1/3" />
        </div>
        {range(rows).map((i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ml-auto h-5 w-20 rounded-full" />
          </div>
        ))}
      </Card>
      <div className="grid gap-2 sm:grid-cols-2 md:hidden">
        {range(Math.min(rows, 4)).map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Карточка объекта в списке: заголовок, полоска прогресса, строка мета. */
export function CardSkeleton() {
  return (
    <Card className="gap-2.5 p-4">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-2.5 w-1/2" />
      <Skeleton className="h-3 w-4/5" />
    </Card>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {range(count).map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Сводка: плитки, шахты, два столбца. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {range(4).map((i) => (
          <Card key={i} className="gap-2 p-4">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-3/4" />
          </Card>
        ))}
      </div>
      <Card className="gap-3 p-4">
        <Skeleton className="h-5 w-48" />
        <div className="flex gap-2 overflow-hidden">
          {range(10).map((i) => (
            <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-28 w-8" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 p-4">
          {range(4).map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </Card>
        <Card className="gap-3 p-4">
          {range(4).map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </Card>
      </div>
    </div>
  );
}

/** Карточка объекта: шапка с процентом и лестница этапов. */
export function ObjectSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Skeleton className="h-8 w-24" />
      <Card className="flex-row justify-between gap-4 p-6">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-14 w-24" />
      </Card>
      <Skeleton className="h-9 w-72" />
      <StagesSkeleton />
    </div>
  );
}

export function StagesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Card aria-busy="true" className="gap-3 p-6">
      {range(count).map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </Card>
  );
}

/** Форма или блок со строками. */
export function BlockSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <Card aria-busy="true" className="gap-3 p-6">
      <Skeleton className="h-5 w-1/3" />
      {range(lines).map((i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </Card>
  );
}
