import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ContractDialog, useContract, useSaveContract } from '@/entities/refs';
import { isManager, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { ArrowLeft, Pencil } from '@/shared/ui/icons';
import { BlockSkeleton } from '@/shared/ui/skeletons';
import { MoneyCard, ObjectsCard } from './parts';

/** Договор: реквизиты, объекты списком и деньги по ним. */
export function ContractPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const contract = useContract(id);
  const save = useSaveContract();
  const [editing, setEditing] = useState(false);

  if (contract.isPending) return <BlockSkeleton lines={8} />;
  if (contract.isError) return <p className="text-destructive">{errorMessage(contract.error)}</p>;
  const c = contract.data;
  const canEdit = isManager(user);

  const toggleActive = () =>
    save.mutate(
      { id: c.id, body: { isActive: !c.isActive } },
      {
        onSuccess: () => toast.success(c.isActive ? 'Договор закрыт' : 'Договор снова действует'),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const info: [string, ReactNode][] = [
    [
      'Заказчик',
      <Link key="c" to={`/customers/${c.customer.id}`} className="font-medium hover:underline">
        {c.customer.name}
      </Link>,
    ],
    ['Дата', formatDate(c.date)],
    ['Ответственный в отчёте', c.responsible ?? '—'],
    [
      'Ссылка для фотоотчётов',
      c.photoReportLink ? (
        <a
          key="l"
          href={c.photoReportLink}
          target="_blank"
          rel="noreferrer noopener"
          className="break-all hover:underline"
        >
          {c.photoReportLink}
        </a>
      ) : (
        '—'
      ),
    ],
  ];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Назад
      </Button>
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-semibold">
            Договор № {c.number}{' '}
            {!c.isActive && (
              <Badge variant="outline" className="align-middle">
                закрыт
              </Badge>
            )}
          </h1>
        </div>
        {canEdit && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Изменить
            </Button>
            <Button variant="outline" onClick={toggleActive} disabled={save.isPending}>
              {c.isActive ? 'Закрыть договор' : 'Открыть снова'}
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="mb-2 min-w-0 sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <MoneyCard money={c.money} total={c.objects.length} />
      <ObjectsCard
        objects={c.objects}
        action={
          c.objects.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/objects?contract=${c.id}`}>В списке объектов</Link>
            </Button>
          )
        }
      />

      {editing && <ContractDialog contract={c} onClose={() => setEditing(false)} />}
    </div>
  );
}
