import {
  EXPENSE_KIND_LABELS,
  EXPENSE_KINDS,
  FINANCE_HINTS,
  type FinanceDto,
  type FinanceEntryCreate,
  type FinanceEntryDto,
  type FinanceEntryType,
  type FinanceUpdate,
  financeEntryCreateSchema,
  financeUpdateSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  useAddFinanceEntry,
  useDeleteFinanceEntry,
  useFinance,
  useSaveFinance,
} from '@/entities/claim';
import { hasRole, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime } from '@/shared/lib/format';
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Hint } from '@/shared/ui/hint';
import { Plus, ShieldAlert, Trash2 } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';
import { BlockSkeleton } from '@/shared/ui/skeletons';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';

const rub = (v: number | null) =>
  v === null ? '—' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

const money = {
  setValueAs: (v: string) =>
    v === '' || v === null || v === undefined
      ? null
      : Number(String(v).replace(',', '.').replace(/\s/g, '')),
};

/** Подпись поля с «?» — пояснением по нажатию. */
function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      <Hint>{hint}</Hint>
    </div>
  );
}

/**
 * Деньги объекта: договор, доп. соглашения, платежи, расходы и доходность.
 * Правят администратор и финансист, руководитель видит.
 */
export function FinanceCard({ objectId }: { objectId: string }) {
  const user = useCurrentUser();
  const canEdit = hasRole(user, 'ADMIN', 'FINANCE');
  const finance = useFinance(objectId);

  if (finance.isPending) return <BlockSkeleton lines={6} />;
  if (finance.isError) return <p className="text-destructive">{errorMessage(finance.error)}</p>;
  const f = finance.data;
  const negative = f.profit !== null && f.profit < 0;

  return (
    <div className="space-y-4">
      {negative && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <div className="font-medium">Объект в минусе на {rub(-(f.profit ?? 0))}</div>
            <div className="text-sm">
              Расходы превысили сумму для заказчика. Проверьте расходы или оформите доп. соглашение.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="Сумма для заказчика" hint={FINANCE_HINTS.total} value={rub(f.totalAmount)}>
          {f.agreementsTotal !== 0 &&
            `договор ${rub(f.contractAmount ?? 0)} ${f.agreementsTotal > 0 ? '+' : '−'} ДС ${rub(Math.abs(f.agreementsTotal))}`}
        </Tile>
        <Tile title="Получено" hint={FINANCE_HINTS.payments} value={rub(f.paidAmount)}>
          {f.debt !== null && `ещё должен ${rub(f.debt)}`}
        </Tile>
        <Tile title="Расходы" hint={FINANCE_HINTS.expenses} value={rub(f.expensesTotal)}>
          {f.expensesTotal > 0 &&
            EXPENSE_KINDS.filter((k) => f.expensesByKind[k] > 0)
              .map((k) => `${EXPENSE_KIND_LABELS[k].toLowerCase()} ${rub(f.expensesByKind[k])}`)
              .join(', ')}
        </Tile>
        <Tile
          title="Доходность"
          hint={FINANCE_HINTS.profit}
          value={rub(f.profit)}
          tone={f.profit === null ? undefined : negative ? 'bad' : 'good'}
        >
          {f.margin !== null && `${f.margin}% от суммы для заказчика`}
        </Tile>
      </div>

      <ContractForm objectId={objectId} finance={f} canEdit={canEdit} />

      <EntriesCard
        objectId={objectId}
        type="AGREEMENT"
        title="Доп. соглашения"
        hint={FINANCE_HINTS.agreements}
        empty="Доп. соглашений нет. Добавьте, если сумма для заказчика изменилась."
        addLabel="Доп. соглашение"
        entries={f.entries}
        canEdit={canEdit}
      />
      <EntriesCard
        objectId={objectId}
        type="PAYMENT"
        title="Платежи от заказчика"
        hint={FINANCE_HINTS.payments}
        empty="Платежей пока не было."
        addLabel="Платёж"
        entries={f.entries}
        canEdit={canEdit}
      />
      <EntriesCard
        objectId={objectId}
        type="EXPENSE"
        title="Расходы"
        hint={FINANCE_HINTS.expenses}
        empty="Расходов пока нет: оборудование, оплата работ, доставка — добавляйте по мере трат."
        addLabel="Расход"
        entries={f.entries}
        canEdit={canEdit}
      />
      {f.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Договор в финансах обновлён {formatDateTime(f.updatedAt)}
        </p>
      )}
    </div>
  );
}

function Tile({
  title,
  hint,
  value,
  tone,
  children,
}: {
  title: string;
  hint: string;
  value: string;
  tone?: 'good' | 'bad';
  children?: ReactNode;
}) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {title}
        <Hint>{hint}</Hint>
      </div>
      <div
        className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'bad' && 'text-destructive',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {value}
      </div>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </Card>
  );
}

/** Номер и дата — свои, а если не указаны, то из «Сведений» объекта. */
const toForm = (x: FinanceDto): FinanceUpdate => ({
  contractNumber: x.contractNumber ?? x.objectContract?.number ?? '',
  contractDate: x.contractDate ?? x.objectContract?.date ?? null,
  contractAmount: x.contractAmount,
  closedWorksAmount: x.closedWorksAmount,
});

/**
 * Договор: номер и дата подставлены из «Сведений» объекта. Совпадают с ними — храним пустыми,
 * чтобы смена договора в «Сведениях» подтягивалась и сюда.
 */
function ContractForm({
  objectId,
  finance: f,
  canEdit,
}: {
  objectId: string;
  finance: FinanceDto;
  canEdit: boolean;
}) {
  const save = useSaveFinance(objectId);
  const oc = f.objectContract;
  const form = useForm<FinanceUpdate>({
    resolver: zodResolver(financeUpdateSchema),
    defaultValues: toForm(f),
  });
  const { errors, isDirty } = form.formState;
  useEffect(() => {
    form.reset(toForm(f));
  }, [f, form]);

  const number = form.watch('contractNumber');
  const differs = !!oc && !!number && number !== oc.number;

  const onSubmit = form.handleSubmit((body) => {
    const same = oc && body.contractNumber === oc.number && (body.contractDate ?? null) === oc.date;
    save.mutate(same ? { ...body, contractNumber: null, contractDate: null } : body, {
      onSuccess: () => toast.success('Договор сохранён'),
      onError: (e) => toast.error(errorMessage(e)),
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Договор</CardTitle>
        <CardDescription>
          {oc
            ? `Из «Сведений» объекта: № ${oc.number}${oc.date ? ` от ${formatDate(oc.date)}` : ''}, ${oc.customer}.`
            : 'Договор в «Сведениях» объекта не указан — укажите номер здесь или привяжите договор в «Изменить».'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label htmlFor="contractNumber" hint={FINANCE_HINTS.contract}>
                Номер договора
              </Label>
              <Input id="contractNumber" {...form.register('contractNumber')} />
              {differs && (
                <FieldDescription>Отличается от договора в «Сведениях» объекта</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="contractDate">Дата договора</FieldLabel>
              <Input
                id="contractDate"
                type="date"
                {...form.register('contractDate', { setValueAs: (v) => v || null })}
              />
            </Field>
            <Field data-invalid={!!errors.contractAmount}>
              <Label htmlFor="contractAmount" hint={FINANCE_HINTS.contractAmount}>
                Сумма по договору, ₽
              </Label>
              <Input
                id="contractAmount"
                inputMode="decimal"
                {...form.register('contractAmount', money)}
              />
              <FieldError errors={[errors.contractAmount]} />
            </Field>
            <Field data-invalid={!!errors.closedWorksAmount}>
              <Label htmlFor="closedWorksAmount" hint={FINANCE_HINTS.closedWorksAmount}>
                Закрыто работ по актам, ₽
              </Label>
              <Input
                id="closedWorksAmount"
                inputMode="decimal"
                {...form.register('closedWorksAmount', money)}
              />
              <FieldError errors={[errors.closedWorksAmount]} />
            </Field>
          </fieldset>
          {canEdit && (
            <Button type="submit" disabled={!isDirty || save.isPending}>
              Сохранить
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/** Список одного вида записей с итогом и кнопкой «Добавить». */
function EntriesCard({
  objectId,
  type,
  title,
  hint,
  empty,
  addLabel,
  entries,
  canEdit,
}: {
  objectId: string;
  type: FinanceEntryType;
  title: string;
  hint: string;
  empty: string;
  addLabel: string;
  entries: FinanceEntryDto[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const remove = useDeleteFinanceEntry(objectId);
  const list = entries.filter((e) => e.type === type);
  const total = Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <CardTitle>{title}</CardTitle>
          <Hint>{hint}</Hint>
          {list.length > 0 && (
            <span className="ml-2 text-sm tabular-nums text-muted-foreground">
              итого {rub(total)}
            </span>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            {addLabel}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!list.length ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {list.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                  {formatDate(e.date)}
                </span>
                <span className="min-w-0 flex-1">
                  {e.title}
                  {e.kind && (
                    <Badge variant="outline" className="ml-2 font-normal">
                      {EXPENSE_KIND_LABELS[e.kind]}
                    </Badge>
                  )}
                  {e.author && (
                    <span className="block text-xs text-muted-foreground">{e.author}</span>
                  )}
                </span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    type === 'AGREEMENT' && e.amount < 0 && 'text-destructive',
                  )}
                >
                  {type === 'AGREEMENT' && e.amount > 0 ? '+' : ''}
                  {rub(e.amount)}
                </span>
                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Удалить">
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {e.title}, {rub(e.amount)}. В истории объекта удаление сохранится.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Не удалять</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            remove.mutate(e.id, {
                              onSuccess: () => toast.success('Запись удалена'),
                              onError: (err) => toast.error(errorMessage(err)),
                            })
                          }
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {adding && <EntryDialog objectId={objectId} type={type} onClose={() => setAdding(false)} />}
    </Card>
  );
}

const ENTRY_TEXT: Record<
  FinanceEntryType,
  { title: string; label: string; placeholder: string; amountHint?: string }
> = {
  AGREEMENT: {
    title: 'Доп. соглашение',
    label: 'Номер и суть',
    placeholder: 'ДС №2: замена дверей шахты',
    amountHint: 'Увеличивает сумму для заказчика. Если работы исключили — укажите со знаком минус.',
  },
  PAYMENT: {
    title: 'Платёж от заказчика',
    label: 'Назначение',
    placeholder: 'Аванс, п/п №123',
  },
  EXPENSE: {
    title: 'Расход',
    label: 'Что оплатили',
    placeholder: 'Лифт ЩЛЗ ПП-0411',
  },
};

const today = () => new Date().toLocaleDateString('en-CA');

function EntryDialog({
  objectId,
  type,
  onClose,
}: {
  objectId: string;
  type: FinanceEntryType;
  onClose: () => void;
}) {
  const add = useAddFinanceEntry(objectId);
  const text = ENTRY_TEXT[type];
  const form = useForm<z.input<typeof financeEntryCreateSchema>, unknown, FinanceEntryCreate>({
    resolver: zodResolver(financeEntryCreateSchema),
    defaultValues: {
      type,
      kind: type === 'EXPENSE' ? 'EQUIPMENT' : null,
      title: '',
      amount: '' as unknown as number,
      date: today(),
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await add.mutateAsync(body);
      toast.success(`${text.title}: добавлено`);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={text.title}
      onSubmit={onSubmit}
      submitting={add.isPending}
      submitLabel="Добавить"
    >
      {type === 'EXPENSE' && (
        <Field data-invalid={!!errors.kind}>
          <FieldLabel>Статья</FieldLabel>
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value ?? ''}
                onValueChange={(v) => v && field.onChange(v)}
                className="w-full"
              >
                {EXPENSE_KINDS.map((k) => (
                  <ToggleGroupItem key={k} value={k} className="flex-1">
                    {EXPENSE_KIND_LABELS[k]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
          <FieldError errors={[errors.kind]} />
        </Field>
      )}
      <Field data-invalid={!!errors.title}>
        <FieldLabel htmlFor="entry-title">{text.label}</FieldLabel>
        <Input id="entry-title" placeholder={text.placeholder} {...form.register('title')} />
        <FieldError errors={[errors.title]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.amount}>
          <FieldLabel htmlFor="entry-amount">Сумма, ₽</FieldLabel>
          <Input
            id="entry-amount"
            inputMode="decimal"
            {...form.register('amount', {
              setValueAs: (v: string) => Number(String(v).replace(',', '.').replace(/\s/g, '')),
            })}
          />
          <FieldError errors={[errors.amount]} />
        </Field>
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor="entry-date">Дата</FieldLabel>
          <Input id="entry-date" type="date" {...form.register('date')} />
          <FieldError errors={[errors.date]} />
        </Field>
      </div>
      {text.amountHint && <FieldDescription>{text.amountHint}</FieldDescription>}
    </FormDialog>
  );
}
