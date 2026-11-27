import {
  type LiftCreate,
  type LiftDetails,
  liftCreateSchema,
  liftLabel,
  MAX_LIFTS_AT_ONCE,
  newLiftNames,
  type ObjectDetails,
  WORK_TYPE_LABELS,
  WORK_TYPES,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAddLifts, useUpdateLift } from '@/entities/object';
import { useBrigades } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
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

type AddInput = z.input<typeof liftCreateSchema>;

/**
 * Добавить лифт в объект. Можно сразу несколько одинаковых: «Подъезд» ×3 → «Подъезд 1…3».
 * Если в объекте пока один лифт без названия — спрашиваем название и для него.
 */
export function AddLiftDialog({ object, onClose }: { object: ObjectDetails; onClose: () => void }) {
  const add = useAddLifts(object.id);
  const unnamed = object.lifts.find((l) => !l.name);
  const [first] = object.lifts;
  const schema = unnamed
    ? liftCreateSchema.extend({ existingName: z.string().trim().min(1, 'Дайте название') })
    : liftCreateSchema;
  const form = useForm<AddInput, unknown, LiftCreate>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      count: 1,
      workType: first.workType,
      floors: first.floors,
      capacityKg: first.capacityKg,
      plannedStartDate: first.plannedStartDate,
      brigadeId: null,
      existingName: unnamed ? 'Лифт 1' : undefined,
    },
  });
  const { errors } = form.formState;
  const count = Number(form.watch('count')) || 1;
  const name = form.watch('name').trim();
  const existingName = form.watch('existingName');
  const preview = newLiftNames(
    name,
    Math.min(count, MAX_LIFTS_AT_ONCE),
    object.lifts.map((l) => l.name || existingName || ''),
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
      {unnamed && (
        <Field data-invalid={!!errors.existingName}>
          <FieldLabel htmlFor="existingName">Название лифта, который уже есть</FieldLabel>
          <Input id="existingName" {...form.register('existingName')} />
          <FieldDescription>
            Когда лифтов несколько, у каждого своё название: «Подъезд 1», «Грузовой».
          </FieldDescription>
          <FieldError errors={[errors.existingName]} />
        </Field>
      )}
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="lift-name">Название нового</FieldLabel>
          <Input id="lift-name" placeholder="Подъезд 2, грузовой" {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.count}>
          <FieldLabel htmlFor="lift-count">Сколько</FieldLabel>
          <Input
            id="lift-count"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_LIFTS_AT_ONCE}
            {...form.register('count')}
          />
        </Field>
      </div>
      {count > 1 && name && (
        <FieldDescription className="-mt-2">
          Будут названы:{' '}
          {preview.length > 3
            ? `${preview[0]}, ${preview[1]}, … ${preview.at(-1)}`
            : preview.join(', ')}
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
  name: z.string().trim().max(100),
  floors: liftCreateSchema.shape.floors,
  capacityKg: liftCreateSchema.shape.capacityKg,
  liftInfo: liftCreateSchema.shape.liftInfo,
  plannedStartDate: liftCreateSchema.shape.plannedStartDate,
  brigadeId: liftCreateSchema.shape.brigadeId,
});
type EditInput = z.input<typeof editSchema>;
type EditOutput = z.output<typeof editSchema>;

/** Характеристики, название и бригада одного лифта. */
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
  const form = useForm<EditInput, unknown, EditOutput>({
    resolver: zodResolver(
      multi ? editSchema.extend({ name: z.string().trim().min(1, 'Нужно название') }) : editSchema,
    ),
    defaultValues: {
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
      {multi && (
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="lift-name">Название</FieldLabel>
          <Input id="lift-name" {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
      )}
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
          <Input id="lift-floors" type="number" inputMode="numeric" {...register('floors')} />
          <FieldError errors={[errors.floors]} />
        </Field>
        <Field data-invalid={!!errors.capacityKg}>
          <FieldLabel htmlFor="lift-capacity">Грузоподъёмность, кг</FieldLabel>
          <Input id="lift-capacity" type="number" inputMode="numeric" {...register('capacityKg')} />
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
