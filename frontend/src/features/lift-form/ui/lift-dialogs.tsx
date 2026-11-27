import {
  type LiftCreate,
  type LiftDetails,
  liftCreateSchema,
  liftLabel,
  MAX_LIFTS_AT_ONCE,
  type ObjectDetails,
  planLifts,
  WORK_TYPE_LABELS,
  WORK_TYPES,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAddLifts, useUpdateLift } from '@/entities/object';
import { useBrigades } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { NumberInput } from '@/shared/ui/number-input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Textarea } from '@/shared/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';

/** Бригада лифта: своя или «как у объекта». */
function BrigadeSelect({
  value,
  onChange,
  object,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  object: ObjectDetails;
}) {
  const brigades = useBrigades();
  return (
    <SimpleSelect
      id="lift-brigade"
      value={value}
      onChange={onChange}
      noneLabel={`Как у объекта${object.brigade ? ` (${object.brigade.name})` : ''}`}
      options={(brigades.data ?? [])
        .filter((b) => (b.isActive || b.id === value) && b.id !== object.brigade?.id)
        .map((b) => ({
          value: b.id,
          label: `${b.name}${b.foreman ? ` · ${b.foreman.fullName}` : ''}`,
        }))}
    />
  );
}

/** Подъезды объекта по порядку и следующий свободный номер: «Подъезд 3». */
function entrancesOf(object: ObjectDetails, extra?: string) {
  const list = [...new Set([...object.lifts.map((l) => l.entrance), extra ?? ''])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
  const numbers = list.map((e) => Number(/(\d+)\s*$/.exec(e)?.[1] ?? 0));
  return { list, next: `Подъезд ${Math.max(0, ...numbers) + 1}` };
}

/** Подъезд: выбрать из уже заведённых или ввести новый. */
function EntrancePicker({
  id,
  value,
  onChange,
  entrances,
  next,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  entrances: string[];
  /** Что подставить в новый подъезд */
  next: string;
}) {
  const [creating, setCreating] = useState(
    entrances.length === 0 || (!!value && !entrances.includes(value)),
  );
  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Подъезд 1"
          autoFocus={entrances.length > 0}
        />
        {entrances.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setCreating(false);
              onChange(entrances[0]);
            }}
          >
            Из списка
          </Button>
        )}
      </div>
    );
  }
  return (
    <SimpleSelect
      id={id}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
      placeholder="Выберите подъезд"
      options={entrances.map((e) => ({ value: e, label: e }))}
      onCreate={() => {
        setCreating(true);
        onChange(next);
      }}
      createLabel="Новый подъезд"
    />
  );
}

type AddInput = z.input<typeof liftCreateSchema>;

/**
 * Добавить лифты в подъезд — уже заведённый или новый. Без названия несколько лифтов
 * подъезда нумеруются «Лифт 1, 2…»; лифт без подъезда сначала получает подъезд.
 */
export function AddLiftDialog({ object, onClose }: { object: ObjectDetails; onClose: () => void }) {
  const add = useAddLifts(object.id);
  // Лифт без подъезда и названия (объект создавали с одним лифтом): спросим его подъезд
  const unlabeled = object.lifts.find((l) => !l.entrance && !l.name);
  const [first] = object.lifts;
  const schema = unlabeled
    ? liftCreateSchema.extend({
        existingEntrance: z.string().trim().min(1, 'Укажите подъезд'),
      })
    : liftCreateSchema;
  const initial = entrancesOf(object, unlabeled ? 'Подъезд 1' : undefined);
  const form = useForm<AddInput, unknown, LiftCreate>({
    resolver: zodResolver(schema),
    defaultValues: {
      entrance: initial.next,
      name: '',
      count: 1,
      workType: first.workType,
      floors: first.floors,
      capacityKg: first.capacityKg,
      plannedStartDate: first.plannedStartDate,
      brigadeId: null,
      existingEntrance: unlabeled ? 'Подъезд 1' : undefined,
    },
  });
  const { errors } = form.formState;
  const count = Math.min(Number(form.watch('count')) || 1, MAX_LIFTS_AT_ONCE);
  const name = (form.watch('name') ?? '').trim();
  const entrance = (form.watch('entrance') ?? '').trim();
  const existingEntrance = form.watch('existingEntrance') ?? '';
  const { list: entrances, next } = entrancesOf(object, existingEntrance);
  // Как будут подписаны лифты — та же логика, что на сервере
  const inEntrance = object.lifts
    .map((l) => ({ ...l, entrance: l.entrance || (!l.name ? existingEntrance : '') }))
    .filter((l) => l.entrance === entrance);
  const plan = planLifts(name, count, inEntrance);
  const label = (n: string) => liftLabel({ entrance, name: n, position: 0 });
  const renamed = plan.renames.map(
    (r) => `${label(inEntrance.find((l) => l.id === r.id)?.name ?? '')} → ${label(r.name)}`,
  );

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await add.mutateAsync(body);
      toast.success(count > 1 ? `Добавлено лифтов: ${count}` : 'Лифт добавлен');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Добавить лифт"
      description={object.shortAddress}
      onSubmit={onSubmit}
      submitting={add.isPending}
      submitLabel={count > 1 ? `Добавить ${count}` : 'Добавить'}
    >
      {unlabeled && (
        <Field data-invalid={!!errors.existingEntrance}>
          <FieldLabel htmlFor="existingEntrance">Подъезд лифта, который уже есть</FieldLabel>
          <Input id="existingEntrance" {...form.register('existingEntrance')} />
          <FieldError errors={[errors.existingEntrance]} />
        </Field>
      )}
      <Field data-invalid={!!errors.entrance}>
        <FieldLabel htmlFor="lift-entrance">Подъезд</FieldLabel>
        <Controller
          control={form.control}
          name="entrance"
          render={({ field }) => (
            <EntrancePicker
              id="lift-entrance"
              value={field.value}
              onChange={field.onChange}
              entrances={entrances}
              next={next}
            />
          )}
        />
        <FieldError errors={[errors.entrance]} />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="lift-name">Название (необязательно)</FieldLabel>
          <Input id="lift-name" placeholder="Грузовой" {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.count}>
          <FieldLabel htmlFor="lift-count">Сколько</FieldLabel>
          <NumberInput
            id="lift-count"
            min={1}
            max={MAX_LIFTS_AT_ONCE}
            {...form.register('count')}
          />
        </Field>
      </div>
      {entrance && (
        <FieldDescription className="-mt-2">
          Будут:{' '}
          {plan.names.length > 3
            ? `${label(plan.names[0])}; ${label(plan.names[1])}; … ${label(plan.names.at(-1) ?? '')}`
            : plan.names.map(label).join('; ')}
          {renamed.length > 0 && `. Уже есть: ${renamed.join('; ')}`}
        </FieldDescription>
      )}
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
      <LiftFields form={form} errors={errors} />
      <Field>
        <FieldLabel htmlFor="lift-brigade">Бригада</FieldLabel>
        <Controller
          control={form.control}
          name="brigadeId"
          render={({ field }) => (
            <BrigadeSelect value={field.value} onChange={field.onChange} object={object} />
          )}
        />
      </Field>
    </FormDialog>
  );
}

const editSchema = z.object({
  entrance: z.string().trim().max(100),
  name: z.string().trim().max(100),
  floors: liftCreateSchema.shape.floors,
  capacityKg: liftCreateSchema.shape.capacityKg,
  liftInfo: liftCreateSchema.shape.liftInfo,
  plannedStartDate: liftCreateSchema.shape.plannedStartDate,
  brigadeId: liftCreateSchema.shape.brigadeId,
});
type EditInput = z.input<typeof editSchema>;
type EditOutput = z.output<typeof editSchema>;

/** Подъезд, название, характеристики и бригада одного лифта. */
export function EditLiftDialog({
  object,
  lift,
  onClose,
}: {
  object: ObjectDetails;
  lift: LiftDetails;
  onClose: () => void;
}) {
  const update = useUpdateLift(object.id);
  const multi = object.lifts.length > 1;
  const { list: entrances, next } = entrancesOf(object);
  const form = useForm<EditInput, unknown, EditOutput>({
    resolver: zodResolver(
      multi
        ? editSchema.refine((v) => v.entrance || v.name, {
            path: ['entrance'],
            message: 'Укажите подъезд или название',
          })
        : editSchema,
    ),
    defaultValues: {
      entrance: lift.entrance,
      name: lift.name,
      floors: lift.floors,
      capacityKg: lift.capacityKg,
      liftInfo: lift.liftInfo ?? '',
      plannedStartDate: lift.plannedStartDate,
      brigadeId: lift.ownBrigade ? (lift.brigade?.id ?? null) : null,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await update.mutateAsync({ liftId: lift.id, body });
      toast.success('Лифт сохранён');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={multi ? liftLabel(lift) : 'Лифт'}
      description={object.shortAddress}
      onSubmit={onSubmit}
      submitting={update.isPending}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.entrance}>
          <FieldLabel htmlFor="lift-entrance">Подъезд</FieldLabel>
          <Controller
            control={form.control}
            name="entrance"
            render={({ field }) => (
              <EntrancePicker
                id="lift-entrance"
                value={field.value}
                onChange={field.onChange}
                entrances={entrances}
                next={next}
              />
            )}
          />
          <FieldError errors={[errors.entrance]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="lift-name">Название</FieldLabel>
          <Input id="lift-name" placeholder="Грузовой" {...form.register('name')} />
        </Field>
      </div>
      <LiftFields form={form} errors={errors} withInfo />
      <Field>
        <FieldLabel htmlFor="lift-brigade">Бригада</FieldLabel>
        <Controller
          control={form.control}
          name="brigadeId"
          render={({ field }) => (
            <BrigadeSelect value={field.value} onChange={field.onChange} object={object} />
          )}
        />
        <FieldDescription>
          Своя бригада — если этот лифт монтирует не та бригада, что ведёт объект.
        </FieldDescription>
      </Field>
    </FormDialog>
  );
}

type LiftFieldsForm = {
  register: ReturnType<typeof useForm<EditInput>>['register'];
};

/** Этажность, грузоподъёмность, начало работ (и сведения о лифте при правке). */
function LiftFields({
  form,
  errors,
  withInfo,
}: {
  // Обе формы содержат эти поля — типы совпадают по именам
  form: unknown;
  errors: Partial<Record<'floors' | 'capacityKg' | 'plannedStartDate', { message?: string }>>;
  withInfo?: boolean;
}) {
  const { register } = form as LiftFieldsForm;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.floors}>
          <FieldLabel htmlFor="lift-floors">Этажность</FieldLabel>
          <NumberInput id="lift-floors" min={1} {...register('floors')} />
          <FieldError errors={[errors.floors]} />
        </Field>
        <Field data-invalid={!!errors.capacityKg}>
          <FieldLabel htmlFor="lift-capacity">Грузоподъёмность, кг</FieldLabel>
          <NumberInput id="lift-capacity" min={0} step={50} {...register('capacityKg')} />
          <FieldError errors={[errors.capacityKg]} />
        </Field>
      </div>
      <Field data-invalid={!!errors.plannedStartDate}>
        <FieldLabel htmlFor="lift-start">Начало работ (план)</FieldLabel>
        <Input
          id="lift-start"
          type="date"
          {...register('plannedStartDate', { setValueAs: (v) => v || null })}
        />
        <FieldDescription>От него считаются плановые даты этапов лифта</FieldDescription>
      </Field>
      {withInfo && (
        <Field>
          <FieldLabel htmlFor="lift-info">Сведения о лифте</FieldLabel>
          <Textarea
            id="lift-info"
            rows={2}
            placeholder="Модель, завод, заводской номер"
            {...register('liftInfo')}
          />
        </Field>
      )}
    </>
  );
}
