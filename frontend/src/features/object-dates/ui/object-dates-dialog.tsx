import {
  DELIVERY_LABELS,
  DELIVERY_STATUSES,
  type ObjectDetails,
  type ObjectUpdate,
  objectUpdateSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useUpdateObject } from '@/entities/object';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';

const schema = objectUpdateSchema.pick({
  deliveryStatus: true,
  deliveryPlannedDate: true,
  deliveryActualDate: true,
  plannedStartDate: true,
  openedDate: true,
  ptoDate: true,
  declarationDate: true,
  commissionedDate: true,
  acceptanceDate: true,
  ksDate: true,
});
type FormInput = z.input<typeof schema>;
type DateKey = Exclude<keyof FormInput, 'deliveryStatus'>;

const DATES: [DateKey, string][] = [
  ['plannedStartDate', 'Плановое начало'],
  ['openedDate', 'Открытие объекта'],
  ['ptoDate', 'ПТО'],
  ['declarationDate', 'Декларация'],
  ['commissionedDate', 'Ввод в эксплуатацию'],
  ['acceptanceDate', 'Комиссионная приёмка'],
  ['ksDate', 'КС-2, КС-3'],
];

/** Поставка оборудования и контрольные даты объекта. */
export function ObjectDatesDialog({
  object,
  trigger,
}: {
  object: ObjectDetails;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateObject(object.id);
  const defaults = (): FormInput => ({
    deliveryStatus: object.deliveryStatus,
    deliveryPlannedDate: object.deliveryPlannedDate,
    deliveryActualDate: object.deliveryActualDate,
    ...Object.fromEntries(DATES.map(([k]) => [k, object[k]])),
  });
  const form = useForm<FormInput, unknown, ObjectUpdate>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Даты сохранены');
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  const dateInput = (key: DateKey, label: string) => (
    <Field key={key}>
      <FieldLabel htmlFor={key}>{label}</FieldLabel>
      <Input id={key} type="date" {...form.register(key, { setValueAs: (v) => v || null })} />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) form.reset(defaults());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Поставка и даты</DialogTitle>
          <DialogDescription>{object.shortAddress}</DialogDescription>
        </DialogHeader>
        <form id="dates-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <FieldSet>
              <FieldLegend variant="label">Поставка оборудования</FieldLegend>
              <Controller
                control={form.control}
                name="deliveryStatus"
                render={({ field }) => (
                  <SimpleSelect
                    aria-label="Статус поставки"
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? 'NOT_ORDERED')}
                    options={DELIVERY_STATUSES.map((s) => ({
                      value: s,
                      label: DELIVERY_LABELS[s],
                    }))}
                  />
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                {dateInput('deliveryPlannedDate', 'План')}
                {dateInput('deliveryActualDate', 'Факт')}
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Контрольные даты</FieldLegend>
              <div className="grid grid-cols-2 gap-3">
                {DATES.map(([k, label]) => dateInput(k, label))}
              </div>
            </FieldSet>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="submit" form="dates-form" disabled={form.formState.isSubmitting}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
