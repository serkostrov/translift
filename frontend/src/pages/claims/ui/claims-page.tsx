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
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

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
        <Skeleton className="h-64" />
      ) : !claims.data?.length ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Рекламаций нет</Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№</TableHead>
                <TableHead>Объект</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Поставщик</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.data.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => setParam('id', c.id)}
                >
                  <TableCell className="tabular-nums">{c.number}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    <div className="font-medium">{c.object.shortAddress}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">
                      {c.description}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDate(c.date)}</TableCell>
                  <TableCell>{c.supplier}</TableCell>
                  <TableCell>{CLAIM_KIND_LABELS[c.kind]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ClaimStatusBadge status={c.status} />
                      {c.commentsCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MessageSquare className="size-3" />
                          {c.commentsCount}
                        </span>
                      )}
                      {c.filesCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Paperclip className="size-3" />
                          {c.filesCount}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ClaimSheet id={openId} onClose={() => setParam('id', null)} />
    </div>
  );
}
