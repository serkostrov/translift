import {
  OBJECT_STATE_LABELS,
  OBJECT_STATES,
  type ObjectListItem,
  type ObjectListQuery,
  WORK_TYPE_LABELS,
} from '@contracts';
import { Archive, Plus, Search } from 'lucide-react';
import { useDeferredValue } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FlagBadge, ObjectStateBadge, StageSegments, useObjects } from '@/entities/object';
import { useBrigades, useContracts } from '@/entities/refs';
import { isManager, useCurrentUser } from '@/entities/session';
import { ObjectFormDialog } from '@/features/object-form';
import { formatDate, formatDaysLeft } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { ListSkeleton } from '@/shared/ui/skeletons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

const STATE_OPTIONS = [
  ...OBJECT_STATES.map((s) => ({ value: s, label: OBJECT_STATE_LABELS[s] })),
  { value: 'risk', label: 'Под риском' },
];

export function ObjectsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const brigades = useBrigades();
  const contracts = useContracts();

  // Фильтры живут в URL: ссылкой на отфильтрованный список можно поделиться
  const q = params.get('q') ?? '';
  const deferredQ = useDeferredValue(q);
  const showArchive = params.get('archive') === '1';
  const query: ObjectListQuery = {
    q: deferredQ || undefined,
    brigade: (params.get('brigade') as ObjectListQuery['brigade']) ?? undefined,
    state: (params.get('state') as ObjectListQuery['state']) ?? undefined,
    contractId: params.get('contract') ?? undefined,
    archived: showArchive || undefined,
  };
  const objects = useObjects(query);
  // Сколько в архиве — для кнопки; без фильтров, чтобы число не прыгало
  const archivedCount = useObjects({ archived: true }).data?.length ?? 0;

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  const rows = objects.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">
          {showArchive ? 'Архив объектов' : 'Объекты'}
        </h1>
        {(archivedCount > 0 || showArchive) && (
          <Button variant="outline" onClick={() => setParam('archive', showArchive ? null : '1')}>
            {showArchive ? (
              'Действующие'
            ) : (
              <>
                <Archive />
                Архив ({archivedCount})
              </>
            )}
          </Button>
        )}
        {isManager(user) && !showArchive && (
          <ObjectFormDialog
            trigger={
              <Button>
                <Plus />
                Добавить объект
              </Button>
            }
          />
        )}
      </div>

      {showArchive && (
        <p className="text-sm text-muted-foreground">
          Архивные объекты не попадают в сводку и общие отчёты. Чтобы вернуть объект в работу,
          откройте его и нажмите «Из архива».
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск по адресу"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            className="pl-8"
          />
        </div>
        <SimpleSelect
          aria-label="Бригада"
          className="w-[calc(50%-4px)] sm:w-52"
          value={params.get('brigade')}
          onChange={(v) => setParam('brigade', v)}
          noneLabel="Все бригады"
          options={[
            ...(brigades.data ?? []).map((b) => ({ value: b.id, label: b.name })),
            { value: 'none', label: 'Без бригады' },
          ]}
        />
        <SimpleSelect
          aria-label="Состояние"
          className="w-[calc(50%-4px)] sm:w-44"
          value={params.get('state')}
          onChange={(v) => setParam('state', v)}
          noneLabel="Все состояния"
          options={STATE_OPTIONS}
        />
        <SimpleSelect
          aria-label="Договор"
          className="w-full sm:w-64"
          value={params.get('contract')}
          onChange={(v) => setParam('contract', v)}
          noneLabel="Все договоры"
          options={(contracts.data ?? []).map((c) => ({
            value: c.id,
            label: `${c.number} · ${c.customer.name}`,
          }))}
        />
      </div>

      {objects.isPending ? (
        <ListSkeleton rows={8} />
      ) : objects.isError ? (
        <p className="text-destructive">Не удалось загрузить объекты</p>
      ) : rows.length === 0 ? (
        <Card className="items-center p-10 text-center">
          <p className="font-medium">{showArchive ? 'В архиве пусто' : 'Ничего не найдено'}</p>
          {!showArchive && (
            <p className="text-sm text-muted-foreground">Измените фильтр или добавьте объект</p>
          )}
        </Card>
      ) : (
        <>
          {/* Телефон: карточки */}
          <div
            className={cn(
              'grid gap-2 sm:grid-cols-2 lg:hidden',
              objects.isPlaceholderData && 'opacity-60',
            )}
          >
            {rows.map((o) => (
              <ObjectCard key={o.id} object={o} />
            ))}
          </div>

          {/* Десктоп: таблица */}
          <Card className={cn('hidden py-0 lg:block', objects.isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Эт. / г/п</TableHead>
                  <TableHead>Бригада</TableHead>
                  <TableHead>Текущий этап</TableHead>
                  <TableHead>Выполнено</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead>Состояние</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/objects/${o.id}`)}
                  >
                    <TableCell className="max-w-80 whitespace-normal">
                      <Link
                        to={`/objects/${o.id}`}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.shortAddress}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {WORK_TYPE_LABELS[o.workType]}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {o.floors ?? '—'} / {o.capacityKg ? `${o.capacityKg} кг` : '—'}
                    </TableCell>
                    <TableCell>
                      {o.brigade?.name ?? (
                        <Badge variant="destructive" className="font-normal">
                          не назначена
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal">
                      {o.currentStage?.shortName ?? 'Не начат'}
                    </TableCell>
                    <TableCell>
                      <StageSegments object={o} />
                    </TableCell>
                    <TableCell>
                      <Deadline object={o} />
                    </TableCell>
                    <TableCell className="space-y-1">
                      <ObjectStateBadge state={o.state} />
                      {o.flags[0] && (
                        <div>
                          <FlagBadge flag={o.flags[0]} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {objects.data && (
        <p className="text-xs text-muted-foreground">Объектов: {objects.data.length}</p>
      )}
    </div>
  );
}

function Deadline({ object: o }: { object: ObjectListItem }) {
  return (
    <div>
      <div className="tabular-nums">{formatDate(o.deadline)}</div>
      {o.state !== 'DONE' && o.daysLeft !== null && (
        <div className={cn('text-xs', o.isRisk ? 'text-destructive' : 'text-muted-foreground')}>
          {formatDaysLeft(o.daysLeft)}
        </div>
      )}
    </div>
  );
}

function ObjectCard({ object: o }: { object: ObjectListItem }) {
  return (
    <Link to={`/objects/${o.id}`} className="block h-full">
      <Card className="h-full gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium">{o.shortAddress}</div>
          <ObjectStateBadge state={o.state} />
        </div>
        <StageSegments object={o} />
        <div className="text-sm text-muted-foreground">
          {o.currentStage?.shortName ?? 'Этапы не отмечены'} · {o.brigade?.name ?? 'без бригады'}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Срок {formatDate(o.deadline)}</span>
          {o.flags.map((f) => (
            <FlagBadge key={f.code} flag={f} />
          ))}
        </div>
      </Card>
    </Link>
  );
}
