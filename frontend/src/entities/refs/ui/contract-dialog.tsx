import { type ContractDto, type ContractUpsert, contractUpsertSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessage } from '@/shared/api/http';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { useCustomers, useSaveContract } from '../api/refs';
import { CustomerDialog } from './customer-dialog';

type FormInput = z.input<typeof contractUpsertSchema>;

/** Договор с заказчиком: создание и правка. Заказчика можно завести прямо отсюда. */
export function ContractDialog({
  contract,
  onClose,
  onSaved,
}: {
  contract: ContractDto | null;
  onClose: () => void;
  onSaved?: (contract: ContractDto) => void;
}) {
  const save = useSaveContract();
  const customers = useCustomers();
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const form = useForm<FormInput, unknown, ContractUpsert>({
    resolver: zodResolver(contractUpsertSchema),
    defaultValues: {
      // Заказчика не подставляем: выбирают явно, чтобы не привязать договор не к тому
      customerId: contract?.customer.id ?? '',
      number: contract?.number ?? '',
      date: contract?.date ?? null,
      responsible: contract?.responsible ?? '',
      photoReportLink: contract?.photoReportLink ?? '',
      isActive: contract?.isActive ?? true,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const saved = await save.mutateAsync({ id: contract?.id, body });
      toast.success(contract ? 'Договор сохранён' : 'Договор добавлен');
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={contract ? `Договор № ${contract.number}` : 'Новый договор'}
      onSubmit={onSubmit}
      submitting={save.isPending}
      nested={
        creatingCustomer && (
          <CustomerDialog
            onClose={() => setCreatingCustomer(false)}
            onSaved={(c) => form.setValue('customerId', c.id, { shouldValidate: true })}
          />
        )
      }
    >
      <Field data-invalid={!!errors.customerId}>
        <FieldLabel htmlFor="customerId">Заказчик / генподрядчик</FieldLabel>
        <Controller
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <SimpleSelect
              id="customerId"
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? '')}
              placeholder="Выберите заказчика"
              options={(customers.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              onCreate={() => setCreatingCustomer(true)}
              createLabel="Новый заказчик"
            />
          )}
        />
        <FieldError errors={errors.customerId && [{ message: 'Выберите заказчика' }]} />
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
