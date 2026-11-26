import type { BrigadeDto } from '@contracts';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { BrigadeDialog, useBrigades } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataList } from '@/shared/ui/data-list';

export function BrigadesTab() {
  const brigades = useBrigades();
  const user = useCurrentUser();
  const [editing, setEditing] = useState<BrigadeDto | 'new' | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const all = brigades.data ?? [];
  const archived = all.filter((b) => !b.isActive).length;
  const rows = showArchive ? all.filter((b) => !b.isActive) : all.filter((b) => b.isActive);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Бригадир — пользователь с ролью «Бригадир». Он видит в телефоне объекты своей бригады.
        </p>
        <div className="flex gap-2">
          {(archived > 0 || showArchive) && (
            <Button variant="outline" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Действующие' : `Архив (${archived})`}
            </Button>
          )}
          {!showArchive && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Бригада
            </Button>
          )}
        </div>
      </div>
      <DataList
        rows={rows}
        empty={showArchive ? 'В архиве пусто' : 'Бригад пока нет'}
        rowKey={(b) => b.id}
        onRowClick={setEditing}
        columns={[
          {
            key: 'name',
            header: 'Бригада',
            mobile: 'title',
            cell: (b) => (
              <span className="font-medium">
                {b.name} {!b.isActive && <Badge variant="outline">в архиве</Badge>}
              </span>
            ),
          },
          { key: 'foreman', header: 'Бригадир', cell: (b) => b.foreman?.fullName ?? '—' },
          {
            key: 'headcount',
            header: 'Человек',
            cell: (b) => b.headcount,
            className: 'tabular-nums',
          },
          {
            key: 'objects',
            header: 'Объектов в работе',
            cell: (b) => b.activeObjects,
            className: 'tabular-nums',
          },
        ]}
      />
      {editing && (
        <BrigadeDialog
          brigade={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          canCreateForeman={hasRole(user, 'ADMIN')}
        />
      )}
    </div>
  );
}
