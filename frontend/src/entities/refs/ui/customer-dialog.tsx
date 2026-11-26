import { type CustomerDto, type CustomerUpsert, customerUpsertSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessage } from '@/shared/api/http';
import { Field, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { useSaveCustomer } from '../api/refs';

/** Заказчик или генподрядчик: новый или правка существующего. */
export function CustomerDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer?: CustomerDto | null;
  onClose: () => void;
  onSaved?: (customer: CustomerDto) => void;
}) {
  const save = useSaveCustomer();
  const form = useForm<z.input<typeof customerUpsertSchema>, unknown, CustomerUpsert>({
    resolver: zodResolver(customerUpsertSchema),
    defaultValues: { name: customer?.name ?? '', inn: customer?.inn ?? '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const saved = await save.mutateAsync({ id: customer?.id, body });
      toast.success(customer ? 'Заказчик сохранён' : 'Заказчик добавлен');
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
      title={customer ? customer.name : 'Новый заказчик'}
      description="Заказчик или генподрядчик, с которым заключён договор."
      onSubmit={onSubmit}
      submitting={save.isPending}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="customer-name">Название</FieldLabel>
        <Input id="customer-name" placeholder="ООО «…»" {...form.register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.inn}>
        <FieldLabel htmlFor="customer-inn">ИНН</FieldLabel>
        <Input id="customer-inn" inputMode="numeric" {...form.register('inn')} />
        <FieldError errors={[errors.inn]} />
      </Field>
    </FormDialog>
  );
}
