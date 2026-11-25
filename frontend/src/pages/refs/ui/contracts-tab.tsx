import { type ContractDto, type ContractUpsert, contractUpsertSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useContracts, useCustomers, useSaveContract, useSaveCustomer } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataList } from '@/shared/ui/data-list';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { FormDialog } from './form-dialog';

type FormInput = z.input<typeof contractUpsertSchema> & { newCustomer?: string };

export function ContractsTab() {
  const contracts = useContracts();
  const [editing, setEditing] = useState<ContractDto | 'new' | null>(null);

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
      <DataList
        rows={contracts.data ?? []}
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
            cell: (c) => c.objectsCount,
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

const NEW_CUSTOMER = '__new__';

function ContractDialog({
  contract,
  onClose,
}: {
  contract: ContractDto | null;
  onClose: () => void;
}) {
  const save = useSaveContract();
  const saveCustomer = useSaveCustomer();
  const customers = useCustomers();
  const [newCustomer, setNewCustomer] = useState('');
  const form = useForm<FormInput, unknown, ContractUpsert>({
    resolver: zodResolver(contractUpsertSchema),
    defaultValues: {
      customerId: contract?.customer.id ?? customers.data?.[0]?.id ?? NEW_CUSTOMER,
      number: contract?.number ?? '',
      date: contract?.date ?? null,
      responsible: contract?.responsible ?? '',
      photoReportLink: contract?.photoReportLink ?? '',
      isActive: contract?.isActive ?? true,
    },
  });
  const { errors } = form.formState;
  const customerId = form.watch('customerId');

  const submit = async () => {
    try {
      // Новый заказчик создаётся прямо из формы договора
      if (form.getValues('customerId') === NEW_CUSTOMER) {
        if (!newCustomer.trim()) {
          toast.error('Укажите заказчика');
          return;
        }
        const c = await saveCustomer.mutateAsync({ body: { name: newCustomer.trim() } });
        form.setValue('customerId', c.id);
      }
      await form.handleSubmit(async (body) => {
        await save.mutateAsync({ id: contract?.id, body });
        toast.success('Договор сохранён');
        onClose();
      })();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={contract ? `Договор № ${contract.number}` : 'Новый договор'}
      onSubmit={submit}
      submitting={save.isPending || saveCustomer.isPending}
    >
      <Field>
        <FieldLabel htmlFor="customerId">Заказчик / генподрядчик</FieldLabel>
        <Controller
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <SimpleSelect
              id="customerId"
              value={field.value}
              onChange={(v) => field.onChange(v ?? NEW_CUSTOMER)}
              options={[
                ...(customers.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                { value: NEW_CUSTOMER, label: '+ Новый заказчик' },
              ]}
            />
          )}
        />
        {customerId === NEW_CUSTOMER && (
          <Input
            placeholder="ООО «…»"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            aria-label="Название заказчика"
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.number}>
          <FieldLabel htmlFor="number">Номер</FieldLabel>
          <Input id="number" {...form.register('number')} />
          <FieldError errors={[errors.number]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="date">Дата</FieldLabel>
          <Input
            id="date"
            type="date"
            {...form.register('date', { setValueAs: (v) => v || null })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="responsible">Ответственный в отчёте</FieldLabel>
        <Input id="responsible" placeholder="ФИО" {...form.register('responsible')} />
      </Field>
      <Field data-invalid={!!errors.photoReportLink}>
        <FieldLabel htmlFor="photoReportLink">Ссылка для фотоотчётов</FieldLabel>
        <Input
          id="photoReportLink"
          type="url"
          placeholder="https://…"
          {...form.register('photoReportLink')}
        />
        <FieldDescription>Попадает в шапку отчёта генподрядчику</FieldDescription>
        <FieldError errors={[errors.photoReportLink]} />
      </Field>
    </FormDialog>
  );
}
