import { type FinanceDto, type FinanceUpdate, financeUpdateSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useFinance, useSaveFinance } from '@/entities/claim';
import { hasRole, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { BlockSkeleton } from '@/shared/ui/skeletons';

const rub = (v: number | null) =>
  v === null ? '—' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

const MONEY: [keyof FinanceDto & keyof FinanceUpdate, string][] = [
  ['contractAmount', 'Сумма договора'],
  ['equipmentCost', 'Стоимость оборудования от завода'],
  ['customerPrice', 'Стоимость для заказчика'],
  ['closedWorksAmount', 'Сумма закрытых работ'],
  ['paidAmount', 'Поступившая оплата'],
];

const toForm = (f: FinanceDto): FinanceUpdate => ({
  contractNumber: f.contractNumber ?? '',
  contractDate: f.contractDate,
  contractAmount: f.contractAmount,
  equipmentCost: f.equipmentCost,
  customerPrice: f.customerPrice,
  closedWorksAmount: f.closedWorksAmount,
  paidAmount: f.paidAmount,
});

/** Договорные и финансовые сведения: правят администратор и финансист, руководитель видит. */
export function FinanceCard({ objectId }: { objectId: string }) {
  const user = useCurrentUser();
  const canEdit = hasRole(user, 'ADMIN', 'FINANCE');
  const finance = useFinance(objectId);
  const save = useSaveFinance(objectId);
  const form = useForm<FinanceUpdate>({ resolver: zodResolver(financeUpdateSchema) });
  const { errors, isDirty } = form.formState;

  useEffect(() => {
    if (finance.data) form.reset(toForm(finance.data));
  }, [finance.data, form]);

  if (finance.isPending) return <BlockSkeleton lines={6} />;
  if (finance.isError) return <p className="text-destructive">{errorMessage(finance.error)}</p>;
  const f = finance.data;
  const oc = f.objectContract;
  // Свой номер в финансах не указан — действует договор из «Сведений»
  const ownContract = f.contractNumber !== null;

  const onSubmit = form.handleSubmit((body) =>
    save.mutate(body, {
      onSuccess: () => toast.success('Финансовые сведения сохранены'),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const nullableNumber = {
    setValueAs: (v: string) =>
      v === '' || v === null ? null : Number(String(v).replace(',', '.').replace(/\s/g, '')),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Договор и финансы</CardTitle>
        <CardDescription>
          Остаток = стоимость для заказчика (или сумма договора) − поступившая оплата.
          {f.updatedAt && ` Обновлено ${formatDateTime(f.updatedAt)}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'mb-4 rounded-lg border p-4',
            f.debt !== null && f.debt > 0
              ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              : 'bg-muted/40',
          )}
        >
          <div className="text-sm text-muted-foreground">Остаток задолженности</div>
          <div className="text-2xl font-semibold tabular-nums">{rub(f.debt)}</div>
        </div>

        {canEdit ? (
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <ObjectContractNote contract={oc} own={ownContract} />
            <Field>
              <FieldLabel htmlFor="contractNumber">Номер договора</FieldLabel>
              <Input
                id="contractNumber"
                placeholder={oc ? `${oc.number} — из сведений` : undefined}
                {...form.register('contractNumber')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contractDate">Дата договора</FieldLabel>
              <Input
                id="contractDate"
                type="date"
                {...form.register('contractDate', { setValueAs: (v) => v || null })}
              />
            </Field>
            {MONEY.map(([key, label]) => (
              <Field key={key} data-invalid={!!errors[key]}>
                <FieldLabel htmlFor={key}>{label}, ₽</FieldLabel>
                <Input
                  id={key}
                  inputMode="decimal"
                  placeholder="0"
                  {...form.register(key, nullableNumber)}
                />
                <FieldError errors={[errors[key]]} />
              </Field>
            ))}
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={!isDirty || save.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">Договор</dt>
            <dd>
              {ownContract ? (
                <>
                  {f.contractNumber} {f.contractDate && `от ${formatDate(f.contractDate)}`}
                </>
              ) : oc ? (
                <>
                  {oc.number} {oc.date && `от ${formatDate(oc.date)}`} · {oc.customer}
                </>
              ) : (
                '—'
              )}
            </dd>
            {MONEY.map(([key, label]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{rub(f[key] as number | null)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

/** Откуда в финансах договор: из «Сведений» объекта или свой. */
function ObjectContractNote({
  contract,
  own,
}: {
  contract: FinanceDto['objectContract'];
  own: boolean;
}) {
  const text = !contract
    ? 'Объект не привязан к договору — привяжите в «Изменить» или укажите номер здесь.'
    : own
      ? `В сведениях объекта — договор № ${contract.number} (${contract.customer}). Здесь указан другой: очистите номер, чтобы действовал договор из сведений.`
      : `Действует договор из сведений объекта: № ${contract.number}${contract.date ? ` от ${formatDate(contract.date)}` : ''}, ${contract.customer}. Номер ниже заполняйте, только если по деньгам договор другой.`;
  return <p className="text-sm text-muted-foreground sm:col-span-2">{text}</p>;
}
