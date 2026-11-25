import {
  type ObjectCreate,
  type ObjectDetails,
  objectCreateSchema,
  WORK_TYPE_LABELS,
  WORK_TYPES,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useCreateObject, useUpdateObject } from '@/entities/object';
import { useBrigades, useContracts } from '@/entities/refs';
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Textarea } from '@/shared/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';

type FormInput = z.input<typeof objectCreateSchema>;

/** Короткий адрес из полного: без «г.», «ул.», «д.». */
function shorten(address: string) {
  return address
    .replace(/^\d{6},\s*/, '')
    .replace(/^г\.\s*/, '')
    .replace(/\b(ул\.|улица|д\.|дом)\s*/g, '')
    .replace(/подъезд\s*/g, 'п. ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Props = { object?: ObjectDetails; trigger: ReactNode };

/** Создание и редактирование объекта. */
export function ObjectFormDialog({ object, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const create = useCreateObject();
  const update = useUpdateObject(object?.id ?? '');
  const brigades = useBrigades();
  const contracts = useContracts();

  const form = useForm<FormInput, unknown, ObjectCreate>({
    resolver: zodResolver(objectCreateSchema),
    defaultValues: {
      address: object?.address ?? '',
      shortAddress: object?.shortAddress ?? '',
      floors: object?.floors ?? 9,
      capacityKg: object?.capacityKg ?? 400,
      liftInfo: object?.liftInfo ?? '',
      workType: object?.workType ?? 'REPLACEMENT',
      contractId: object?.contract?.id ?? contracts.data?.find((c) => c.isActive)?.id ?? null,
      brigadeId: object?.brigade?.id ?? null,
      deadline: object?.deadline ?? null,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (object) {
        const { workType: _ignored, ...rest } = values;
        await update.mutateAsync(rest);
        toast.success('Объект сохранён');
      } else {
        const created = await create.mutateAsync(values);
        toast.success('Объект добавлен');
        navigate(`/objects/${created.id}`);
      }
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{object ? 'Редактирование объекта' : 'Новый объект'}</DialogTitle>
          <DialogDescription>
            {object ? object.shortAddress : 'Тип работ задаёт набор этапов и проценты.'}
          </DialogDescription>
        </DialogHeader>

        <form id="object-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            {!object && (
              <Field>
                <FieldLabel>Тип работ</FieldLabel>
                <Controller
                  control={form.control}
                  name="workType"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="w-full"
                    >
                      {WORK_TYPES.map((t) => (
                        <ToggleGroupItem key={t} value={t} className="flex-1">
                          {WORK_TYPE_LABELS[t]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  )}
                />
              </Field>
            )}

            <Field data-invalid={!!errors.address}>
              <FieldLabel htmlFor="address">Адрес МКД</FieldLabel>
              <Input
                id="address"
                placeholder="г. Иваново, ул. …, д. …, подъезд …"
                {...form.register('address', {
                  onBlur: (e) => {
                    if (!form.getValues('shortAddress'))
                      form.setValue('shortAddress', shorten(e.target.value));
                  },
                })}
              />
              <FieldError errors={[errors.address]} />
            </Field>

            <Field data-invalid={!!errors.shortAddress}>
              <FieldLabel htmlFor="shortAddress">Короткий адрес</FieldLabel>
              <Input id="shortAddress" {...form.register('shortAddress')} />
              <FieldDescription>Так объект подписан в списках и у бригадира</FieldDescription>
              <FieldError errors={[errors.shortAddress]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.floors}>
                <FieldLabel htmlFor="floors">Этажность</FieldLabel>
                <Input id="floors" type="number" inputMode="numeric" {...form.register('floors')} />
                <FieldError errors={[errors.floors]} />
              </Field>
              <Field data-invalid={!!errors.capacityKg}>
                <FieldLabel htmlFor="capacityKg">Грузоподъёмность, кг</FieldLabel>
                <Input
                  id="capacityKg"
                  type="number"
                  inputMode="numeric"
                  {...form.register('capacityKg')}
                />
                <FieldError errors={[errors.capacityKg]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="liftInfo">Сведения о лифте</FieldLabel>
              <Textarea
                id="liftInfo"
                rows={2}
                placeholder="Модель, завод, заводской номер"
                {...form.register('liftInfo')}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="contractId">Договор</FieldLabel>
                <Controller
                  control={form.control}
                  name="contractId"
                  render={({ field }) => (
                    <SimpleSelect
                      id="contractId"
                      value={field.value}
                      onChange={field.onChange}
                      noneLabel="Без договора"
                      options={(contracts.data ?? []).map((c) => ({
                        value: c.id,
                        label: `${c.number} · ${c.customer.name}`,
                      }))}
                    />
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.deadline}>
                <FieldLabel htmlFor="deadline">Срок по договору</FieldLabel>
                <Input
                  id="deadline"
                  type="date"
                  {...form.register('deadline', { setValueAs: (v) => v || null })}
                />
                <FieldError errors={[errors.deadline]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="brigadeId">Бригада</FieldLabel>
              <Controller
                control={form.control}
                name="brigadeId"
                render={({ field }) => (
                  <SimpleSelect
                    id="brigadeId"
                    value={field.value}
                    onChange={field.onChange}
                    noneLabel="Назначить позже"
                    options={(brigades.data ?? [])
                      .filter((b) => b.isActive || b.id === field.value)
                      .map((b) => ({
                        value: b.id,
                        label: `${b.name}${b.foreman ? ` · ${b.foreman.fullName}` : ''}`,
                      }))}
                  />
                )}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="submit" form="object-form" disabled={form.formState.isSubmitting}>
            {object ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
