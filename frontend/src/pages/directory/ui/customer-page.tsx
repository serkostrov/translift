import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ContractDialog, CustomerDialog, useCustomer } from '@/entities/refs';
import { isManager, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';
import { ArrowLeft, Pencil, Plus } from '@/shared/ui/icons';
import { BlockSkeleton } from '@/shared/ui/skeletons';
import { MoneyCard, ObjectsCard } from './parts';

/** Заказчик: его договоры, все объекты по ним и деньги одной суммой. */
export function CustomerPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const customer = useCustomer(id);
  const [editing, setEditing] = useState(false);
  const [addingContract, setAddingContract] = useState(false);

  if (customer.isPending) return <BlockSkeleton lines={8} />;
  if (customer.isError) return <p className="text-destructive">{errorMessage(customer.error)}</p>;
  const c = customer.data;
  const canEdit = isManager(user);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Назад
      </Button>
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold break-words">{c.name}</h1>
          <p className="text-sm text-muted-foreground">
            {c.inn ? `ИНН ${c.inn}` : 'ИНН не указан'}
          </p>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            Изменить
          </Button>
        )}
      </div>

      <MoneyCard money={c.money} total={c.objects.length} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            Договоры{' '}
            <span className="text-muted-foreground tabular-nums">{c.contracts.length}</span>
          </CardTitle>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setAddingContract(true)}>
              <Plus />
              Договор
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <DataList
            rows={c.contracts}
            rowKey={(k) => k.id}
            onRowClick={(k) => navigate(`/contracts/${k.id}`)}
            empty={<p className="py-4 text-sm text-muted-foreground">Договоров пока нет</p>}
            columns={[
              {
                key: 'number',
                header: 'Договор',
                mobile: 'title',
                cell: (k) => (
                  <span className="font-medium">
                    <Link
                      to={`/contracts/${k.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      № {k.number}
                    </Link>
                    {k.date && (
                      <span className="text-muted-foreground"> от {formatDate(k.date)}</span>
                    )}{' '}
                    {!k.isActive && <Badge variant="outline">закрыт</Badge>}
                  </span>
                ),
              },
              { key: 'responsible', header: 'Ответственный', cell: (k) => k.responsible ?? '—' },
              {
                key: 'objects',
                header: 'Объектов',
                className: 'tabular-nums',
                cell: (k) => k.objectsCount,
              },
            ]}
          />
        </CardContent>
      </Card>

      <ObjectsCard objects={c.objects} />

      {editing && <CustomerDialog customer={c} onClose={() => setEditing(false)} />}
      {addingContract && (
        <ContractDialog
          contract={null}
          defaultCustomerId={c.id}
          onClose={() => setAddingContract(false)}
        />
      )}
    </div>
  );
}
