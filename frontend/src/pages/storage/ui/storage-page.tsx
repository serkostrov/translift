import type { CleanupInput, CleanupPreviewDto, StorageStatsDto } from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { errorMessage, http } from '@/shared/api/http';
import { formatBytes } from '@/shared/lib/image';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { DataList } from '@/shared/ui/data-list';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Trash2 } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/progress';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { DashboardSkeleton } from '@/shared/ui/skeletons';

const MONTHS: Record<string, string> = {
  '01': 'янв',
  '02': 'фев',
  '03': 'мар',
  '04': 'апр',
  '05': 'май',
  '06': 'июн',
  '07': 'июл',
  '08': 'авг',
  '09': 'сен',
  '10': 'окт',
  '11': 'ноя',
  '12': 'дек',
};

export function StoragePage() {
  const stats = useQuery({
    queryKey: ['storage', 'stats'],
    queryFn: () => http<StorageStatsDto>('/storage/stats'),
  });

  if (stats.isPending) return <DashboardSkeleton />;
  if (stats.isError) return <p className="text-destructive">{errorMessage(stats.error)}</p>;
  const s = stats.data;
  const disk = s.disk;
  const used = disk ? disk.totalBytes - disk.freeBytes : 0;
  const maxMonth = Math.max(1, ...s.files.byMonth.map((m) => m.bytes));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Хранилище</h1>
        <p className="text-sm text-muted-foreground">
          Сколько места занимают база и файлы, и очистка старых фото.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 p-4">
          <div className="text-sm text-muted-foreground">Файлы (фото и документы)</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatBytes(s.files.totalBytes)}
          </div>
          <div className="text-xs text-muted-foreground">{s.files.count} файлов</div>
        </Card>
        <Card className="gap-1 p-4">
          <div className="text-sm text-muted-foreground">База данных</div>
          <div className="text-2xl font-semibold tabular-nums">
            {formatBytes(s.database.sizeBytes)}
          </div>
        </Card>
        <Card className="gap-2 p-4">
          <div className="text-sm text-muted-foreground">Диск сервера</div>
          {disk ? (
            <>
              <div className="text-2xl font-semibold tabular-nums">
                {formatBytes(disk.freeBytes)}{' '}
                <span className="text-sm font-normal text-muted-foreground">свободно</span>
              </div>
              <Progress value={(used / disk.totalBytes) * 100} />
              <div className="text-xs text-muted-foreground">
                занято {formatBytes(used)} из {formatBytes(disk.totalBytes)}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">нет данных</div>
          )}
        </Card>
      </div>

      <CleanupCard stats={s} />

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Файлы по месяцам загрузки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {s.files.byMonth.length === 0 && (
              <p className="text-sm text-muted-foreground">Файлов пока нет</p>
            )}
            {s.files.byMonth.map((m) => (
              <div key={m.month} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-muted-foreground">
                  {MONTHS[m.month.slice(5)]} {m.month.slice(0, 4)}
                </span>
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-progress"
                    style={{ width: `${(m.bytes / maxMonth) * 100}%` }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums">{formatBytes(m.bytes)}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              {s.files.byKind
                .map(
                  (k) =>
                    `${k.kind === 'PHOTO' ? 'Фото' : 'Документы'}: ${k.count} шт., ${formatBytes(k.bytes)}`,
                )
                .join(' · ')}
              {s.files.purgedCount > 0 && ` · у ${s.files.purgedCount} фото остались только превью`}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="px-1 font-semibold">Больше всего места</h2>
          <DataList
            rows={s.files.topObjects}
            rowKey={(o) => o.id}
            empty={<Card className="p-6 text-sm text-muted-foreground">Файлов пока нет</Card>}
            columns={[
              {
                key: 'object',
                header: 'Объект',
                mobile: 'title',
                cell: (o) => (
                  <>
                    <Link to={`/objects/${o.id}`} className="hover:underline">
                      {o.shortAddress}
                    </Link>{' '}
                    {o.done && <Badge variant="outline">сдан</Badge>}
                  </>
                ),
              },
              {
                key: 'bytes',
                header: 'Объём',
                mobile: 'aside',
                cell: (o) => formatBytes(o.bytes),
                className: 'tabular-nums',
              },
              { key: 'count', header: 'Файлов', cell: (o) => o.count, className: 'tabular-nums' },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="px-1 font-semibold">Таблицы базы данных</h2>
        <DataList
          rows={s.database.tables}
          rowKey={(t) => t.name}
          columns={[
            {
              key: 'name',
              header: 'Таблица',
              mobile: 'title',
              cell: (t) => <span className="font-mono text-xs">{t.name}</span>,
            },
            {
              key: 'size',
              header: 'Объём',
              mobile: 'aside',
              cell: (t) => formatBytes(t.sizeBytes),
              className: 'tabular-nums',
            },
            {
              key: 'rows',
              header: 'Строк',
              cell: (t) => t.rows.toLocaleString('ru-RU'),
              className: 'tabular-nums',
            },
          ]}
        />
      </div>
    </div>
  );
}

const AGE_OPTIONS = [
  { value: '3', label: 'старше 3 месяцев' },
  { value: '6', label: 'старше 6 месяцев' },
  { value: '12', label: 'старше года' },
  { value: '24', label: 'старше 2 лет' },
];

function CleanupCard({ stats }: { stats: StorageStatsDto }) {
  const qc = useQueryClient();
  const [input, setInput] = useState<CleanupInput>({
    mode: 'ORIGINALS',
    olderThanMonths: 12,
    onlyFinished: true,
    orphansOnly: false,
  });
  const [preview, setPreview] = useState<CleanupPreviewDto | null>(null);

  const previewMutation = useMutation({
    mutationFn: (body: CleanupInput) =>
      http<CleanupPreviewDto>('/storage/cleanup/preview', { method: 'POST', body }),
    onSuccess: setPreview,
  });
  const run = useMutation({
    mutationFn: (body: CleanupInput) =>
      http<CleanupPreviewDto>('/storage/cleanup', { method: 'POST', body }),
    onSuccess: (r) => {
      toast.success(`Очищено: ${r.files} фото, освобождено ${formatBytes(r.bytes)}`);
      qc.invalidateQueries({ queryKey: ['storage'] });
      qc.invalidateQueries({ queryKey: ['files'] });
      previewMutation.mutate(input);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Пересчитываем предпросмотр при каждом изменении условий
  // biome-ignore lint/correctness/useExhaustiveDependencies: mutate стабилен
  useEffect(() => {
    previewMutation.mutate(input);
  }, [input]);

  const set = (patch: Partial<CleanupInput>) => setInput((v) => ({ ...v, ...patch }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Очистка старых фото</CardTitle>
        <CardDescription>
          Оригиналы фото занимают почти всё место. Превью (~30 КБ) остаются, так что история и
          отчёты не пострадают.
          {stats.files.orphans.count > 0 &&
            ` Есть ${stats.files.orphans.count} фото без отметки этапа (${formatBytes(stats.files.orphans.bytes)}).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="mode">Что удалять</FieldLabel>
            <SimpleSelect
              id="mode"
              value={input.mode}
              onChange={(v) => v && set({ mode: v as CleanupInput['mode'] })}
              options={[
                { value: 'ORIGINALS', label: 'Оригиналы, оставить превью' },
                { value: 'FULL', label: 'Фото целиком' },
              ]}
            />
            {input.mode === 'FULL' && (
              <FieldDescription className="text-destructive">
                Фото исчезнут из карточек объектов совсем
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="age">Возраст фото</FieldLabel>
            <SimpleSelect
              id="age"
              value={String(input.olderThanMonths)}
              onChange={(v) => v && set({ olderThanMonths: Number(v) })}
              options={AGE_OPTIONS}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="onlyFinished"
              checked={input.onlyFinished}
              disabled={input.orphansOnly}
              onCheckedChange={(v) => set({ onlyFinished: v === true })}
            />
            <FieldLabel htmlFor="onlyFinished">Только сданные и архивные объекты</FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id="orphansOnly"
              checked={input.orphansOnly}
              onCheckedChange={(v) => set({ orphansOnly: v === true })}
            />
            <FieldLabel htmlFor="orphansOnly">Только фото без отметки этапа</FieldLabel>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <div className={cn('flex-1 text-sm', previewMutation.isPending && 'opacity-60')}>
            {preview ? (
              preview.files ? (
                <>
                  Под условия попадает <b>{preview.files}</b> фото, освободится{' '}
                  <b>{formatBytes(preview.bytes)}</b>
                </>
              ) : (
                'Под условия ничего не попадает'
              )
            ) : (
              'Считаем…'
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!preview?.files || run.isPending}>
                <Trash2 />
                Очистить
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить {preview?.files} фото?</AlertDialogTitle>
                <AlertDialogDescription>
                  {input.mode === 'ORIGINALS'
                    ? 'Оригиналы удалятся без возможности восстановления, останутся превью.'
                    : 'Фото удалятся целиком без возможности восстановления.'}{' '}
                  Освободится {formatBytes(preview?.bytes ?? 0)}. Действие попадёт в журнал.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction variant="danger" onClick={() => run.mutate(input)}>
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
