import type { ContractDto } from '@contracts';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ContractDialog, useContracts } from '@/entities/refs';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataList } from '@/shared/ui/data-list';
import { Input } from '@/shared/ui/input';

export function ContractsTab() {
  const contracts = useContracts();
  const [editing, setEditing] = useState<ContractDto | 'new' | null>(null);
  const [query, setQuery] = useState('');

  // Ищем по номеру, дате (как в списке — дд.мм.гггг), заказчику, ИНН и ответственному
  const rows = useMemo(() => {
    const all = contracts.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) =>
      [c.number, c.date && formatDate(c.date), c.customer.name, c.customer.inn, c.responsible]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [contracts.data, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Договоры с заказчиками и генподрядчиками. Ответственный и ссылка на фото попадают в отчёт.
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Договор
        </Button>
      </div>
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-8"
          placeholder="Номер, дата, заказчик, ИНН"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <DataList
        rows={rows}
        empty={
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query ? 'Ничего не найдено' : 'Договоров пока нет'}
          </p>
        }
        rowKey={(c) => c.id}
        onRowClick={setEditing}
        columns={[
          {
            key: 'number',
            header: 'Договор',
            mobile: 'title',
            cell: (c) => (
              <span className="font-medium">
                № {c.number}
                {c.date && <span className="text-muted-foreground"> от {formatDate(c.date)}</span>}{' '}
                {!c.isActive && <Badge variant="outline">закрыт</Badge>}
              </span>
            ),
          },
          { key: 'customer', header: 'Заказчик', cell: (c) => c.customer.name },
          {
            key: 'responsible',
            header: 'Ответственный в отчёте',
            cell: (c) => c.responsible ?? '—',
          },
          {
            key: 'objects',
            header: 'Объектов',
            // Число — ссылка на список объектов этого договора
            cell: (c) =>
              c.objectsCount ? (
                <Link
                  to={`/objects?contract=${c.id}`}
                  className="underline-offset-4 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.objectsCount}
                </Link>
              ) : (
                0
              ),
            className: 'tabular-nums',
          },
        ]}
      />
      {editing && (
        <ContractDialog
          contract={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
