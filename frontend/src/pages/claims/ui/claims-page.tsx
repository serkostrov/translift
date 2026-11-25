import {
  CLAIM_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUSES,
  type ClaimListQuery,
} from '@contracts';
import { MessageSquare, Paperclip, Plus, Search } from 'lucide-react';
import { useDeferredValue } from 'react';
import { useSearchParams } from 'react-router';
import { ClaimStatusBadge, useClaims } from '@/entities/claim';
import { isManager, useCurrentUser } from '@/entities/session';
import { ClaimFormDialog, ClaimSheet } from '@/features/claim';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { ListSkeleton } from '@/shared/ui/skeletons';

export function ClaimsPage() {
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const deferredQ = useDeferredValue(q);
  const query: ClaimListQuery = {
    q: deferredQ || undefined,
    status: (params.get('status') as ClaimListQuery['status']) ?? undefined,
  };
  const claims = useClaims(query);
  const openId = params.get('id');

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">Рекламации</h1>
        {isManager(user) && (
          <ClaimFormDialog
            onCreated={(id) => setParam('id', id)}
            trigger={
              <Button>
                <Plus />
                Рекламация
              </Button>
            }
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Адрес, поставщик, описание"
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            className="pl-8"
          />
        </div>
        <SimpleSelect
          aria-label="Статус"
          className="w-full sm:w-48"
          value={params.get('status')}
          onChange={(v) => setParam('status', v)}
          noneLabel="Все статусы"
          options={CLAIM_STATUSES.map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }))}
        />
      </div>

      {claims.isPending ? (
        <ListSkeleton rows={6} />
      ) : !claims.data?.length ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Рекламаций нет</Card>
      ) : (
        <DataList
          rows={claims.data}
          rowKey={(c) => c.id}
          onRowClick={(c) => setParam('id', c.id)}
          columns={[
            {
              key: 'object',
              header: 'Объект',
              mobile: 'title',
              cell: (c) => (
                <div className="max-w-72">
                  <span className="text-muted-foreground tabular-nums">№{c.number} </span>
                  <span className="font-medium">{c.object.shortAddress}</span>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Статус',
              mobile: 'aside',
              cell: (c) => <ClaimStatusBadge status={c.status} />,
            },
            {
              key: 'description',
              header: 'Описание',
              mobile: 'body',
              cell: (c) => (
                <div className="line-clamp-2 max-w-80 text-muted-foreground">{c.description}</div>
              ),
            },
            {
              key: 'date',
              header: 'Дата',
              cell: (c) => formatDate(c.date),
              className: 'tabular-nums',
            },
            { key: 'supplier', header: 'Поставщик', cell: (c) => c.supplier },
            { key: 'kind', header: 'Причина', cell: (c) => CLAIM_KIND_LABELS[c.kind] },
            {
              key: 'activity',
              header: 'Обсуждение',
              cell: (c) => (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="size-3" />
                    {c.commentsCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Paperclip className="size-3" />
                    {c.filesCount}
                  </span>
                </span>
              ),
            },
          ]}
        />
      )}

      <ClaimSheet id={openId} onClose={() => setParam('id', null)} />
    </div>
  );
}
