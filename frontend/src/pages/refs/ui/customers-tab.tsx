import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CustomerDialog, useCustomers } from '@/entities/refs';
import { Button } from '@/shared/ui/button';
import { DataList } from '@/shared/ui/data-list';
import { Plus, Search } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';

/** Заказчики и генподрядчики: сколько договоров и объектов; карточка — по клику. */
export function CustomersTab() {
  const customers = useCustomers();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const all = customers.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q) || c.inn?.includes(q));
  }, [customers.data, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Заказчики и генподрядчики. В карточке — их договоры, объекты и деньги.
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Заказчик
        </Button>
      </div>
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-8"
          placeholder="Название или ИНН"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <DataList
        rows={rows}
        rowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        empty={
          <p className="py-6 text-center text-sm text-muted-foreground">
            {query ? 'Ничего не найдено' : 'Заказчиков пока нет'}
          </p>
        }
        columns={[
          {
            key: 'name',
            header: 'Заказчик',
            mobile: 'title',
            cell: (c) => <span className="font-medium">{c.name}</span>,
          },
          { key: 'inn', header: 'ИНН', cell: (c) => c.inn ?? '—' },
          {
            key: 'contracts',
            header: 'Договоров',
            className: 'tabular-nums',
            cell: (c) => c.contractsCount,
          },
          {
            key: 'objects',
            header: 'Объектов',
            className: 'tabular-nums',
            cell: (c) => c.objectsCount,
          },
        ]}
      />
      {creating && (
        <CustomerDialog
          onClose={() => setCreating(false)}
          onSaved={(c) => navigate(`/customers/${c.id}`)}
        />
      )}
    </div>
  );
}
