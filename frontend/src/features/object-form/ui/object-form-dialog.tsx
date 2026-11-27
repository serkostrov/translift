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
import { useCreateObject, useUpdateLift, useUpdateObject } from '@/entities/object';
import { BrigadeDialog, ContractDialog, useBrigades, useContracts } from '@/entities/refs';
import { hasRole, useCurrentUser } from '@/entities/session';
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

/**
 * Значения формы из объекта — считаются при каждом открытии, а не один раз при монтировании:
 * иначе после сохранения форма показывала бы старые договор и бригаду.
 * Договор новому объекту не подставляем — выбирают явно, чтобы не привязать не тот.
 */
const valuesOf = (object?: ObjectDetails): FormInput => {
  const lift = object?.lifts[0];
  return {
    address: object?.address ?? '',
    shortAddress: object?.shortAddress ?? '',
    floors: lift ? lift.floors : 9,
    capacityKg: lift ? lift.capacityKg : 400,
    liftInfo: lift?.liftInfo ?? '',
    workType: lift?.workType ?? 'REPLACEMENT',
    contractId: object?.contract?.id ?? null,
    brigadeId: object?.brigade?.id ?? null,
    deadline: object?.deadline ?? null,
    plannedStartDate: lift?.plannedStartDate ?? null,
  };
};

/**
 * Создание и редактирование объекта. Пока лифт один, характеристики лифта правятся здесь же;
 * у объекта с несколькими лифтами форма — только про общее (адрес, договор, срок, бригада).
 */
export function ObjectFormDialog({ object, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const create = useCreateObject();
  const update = useUpdateObject(object?.id ?? '');
  const updateLift = useUpdateLift(object?.id ?? '');
  // Характеристики лифта в форме — при создании и пока лифт в объекте один
  const singleLift = !object || object.lifts.length === 1;
  const brigades = useBrigades();
  const contracts = useContracts();
  const user = useCurrentUser();
  const [creating, setCreating] = useState<'contract' | 'brigade' | null>(null);

  const form = useForm<FormInput, unknown, ObjectCreate>({
    resolver: zodResolver(objectCreateSchema),
    defaultValues: valuesOf(object),
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (object) {
        const { address, shortAddress, contractId, brigadeId, deadline } = values;
        await update.mutateAsync({ address, shortAddress, contractId, brigadeId, deadline });
        if (singleLift) {
          const { floors, capacityKg, liftInfo, plannedStartDate } = values;
          await updateLift.mutateAsync({
            liftId: object.lifts[0].id,
            body: { floors, capacityKg, liftInfo, plannedStartDate },
          });
        }
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
        if (v) form.reset(valuesOf(object));
        else setCreating(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
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

            {singleLift && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field data-invalid={!!errors.floors}>
                    <FieldLabel htmlFor="floors">Этажность</FieldLabel>
                    <Input
                      id="floors"
                      type="number"
                      inputMode="numeric"
                      {...form.register('floors')}
                    />
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
              </>
            )}

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
                    options={(contracts.data ?? [])
                      .filter((c) => c.isActive || c.id === field.value)
                      .map((c) => ({
                        value: c.id,
                        label: `${c.number} · ${c.customer.name}`,
                      }))}
                    onCreate={() => setCreating('contract')}
                    createLabel="Новый договор"
                  />
                )}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {singleLift && (
                <Field data-invalid={!!errors.plannedStartDate}>
                  <FieldLabel htmlFor="plannedStartDate">Начало работ</FieldLabel>
                  <Input
                    id="plannedStartDate"
                    type="date"
                    {...form.register('plannedStartDate', { setValueAs: (v) => v || null })}
                  />
                  <FieldError errors={[errors.plannedStartDate]} />
                </Field>
              )}
              <Field data-invalid={!!errors.deadline}>
                <FieldLabel htmlFor="deadline">Срок по договору</FieldLabel>
                <Input
                  id="deadline"
                  type="date"
                  {...form.register('deadline', { setValueAs: (v) => v || null })}
                />
                <FieldError errors={[errors.deadline]} />
              </Field>
              <FieldDescription className="col-span-2 -mt-1">
                {singleLift
                  ? 'От начала работ по плановым дням этапов считаются плановые даты — их видно в «Ходе работ» и «Сведениях».'
                  : 'Характеристики и начало работ — у каждого лифта свои: «Изменить лифт» на его вкладке.'}
              </FieldDescription>
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
                    onCreate={() => setCreating('brigade')}
                    createLabel="Новая бригада"
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

        {/* Внутри окна, но вне формы: открываются поверх, submit не всплывает в форму объекта */}
        {creating === 'contract' && (
          <ContractDialog
            contract={null}
            onClose={() => setCreating(null)}
            onSaved={(c) => form.setValue('contractId', c.id, { shouldDirty: true })}
          />
        )}
        {creating === 'brigade' && (
          <BrigadeDialog
            brigade={null}
            canCreateForeman={hasRole(user, 'ADMIN')}
            onClose={() => setCreating(null)}
            onSaved={(b) => form.setValue('brigadeId', b.id, { shouldDirty: true })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
