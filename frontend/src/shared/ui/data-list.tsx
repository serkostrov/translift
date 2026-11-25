import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export type DataColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /**
   * Место в карточке на телефоне:
   * - `title` — крупная первая строка;
   * - `aside` — справа от заголовка (статус, бейдж);
   * - `meta` (по умолчанию) — строка «подпись: значение»;
   * - `body` — отдельной строкой без подписи (описание, прогресс);
   * - `hidden` — не показывать на телефоне.
   */
  mobile?: 'title' | 'aside' | 'meta' | 'body' | 'hidden';
};

type Props<T> = {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** С какой ширины показывать таблицу (по умолчанию md, 768px) */
  breakpoint?: 'md' | 'lg';
  className?: string;
};

/**
 * Список данных: таблица на широком экране, карточки на телефоне.
 * Горизонтальной прокрутки таблиц на мобильных не бывает.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty,
  breakpoint = 'md',
  className,
}: Props<T>) {
  if (!rows.length && empty) return <>{empty}</>;
  const by = (place: DataColumn<T>['mobile']) =>
    columns.filter((c) => (c.mobile ?? 'meta') === place);
  const title = by('title');
  const aside = by('aside');
  const body = by('body');
  const meta = by('meta');

  return (
    <div className={className}>
      <Card className={cn('hidden py-0', breakpoint === 'md' ? 'md:block' : 'lg:block')}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn('whitespace-normal', c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div
        className={cn('grid gap-2 sm:grid-cols-2', breakpoint === 'md' ? 'md:hidden' : 'lg:hidden')}
      >
        {rows.map((row) => {
          const content = (
            <Card key={rowKey(row)} className="h-full gap-1.5 p-4 text-sm">
              {(title.length > 0 || aside.length > 0) && (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-medium">
                    {title.map((c) => (
                      <div key={c.key}>{c.cell(row)}</div>
                    ))}
                  </div>
                  {aside.length > 0 && (
                    <div className="flex shrink-0 items-center gap-1">
                      {aside.map((c) => (
                        <span key={c.key}>{c.cell(row)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {body.map((c) => (
                <div key={c.key} className="min-w-0">
                  {c.cell(row)}
                </div>
              ))}
              {meta.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {meta.map((c) => (
                    <div key={c.key} className="contents">
                      <dt className="text-muted-foreground">{c.header}</dt>
                      <dd className="min-w-0 break-words">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          );
          return onRowClick ? (
            <button
              key={rowKey(row)}
              type="button"
              className="h-full text-left active:opacity-80"
              onClick={() => onRowClick(row)}
            >
              {content}
            </button>
          ) : (
            <div key={rowKey(row)}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
