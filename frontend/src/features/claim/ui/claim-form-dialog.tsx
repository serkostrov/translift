import { CLAIM_KIND_LABELS, CLAIM_KINDS, type ClaimCreate, claimCreateSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateClaim, useSuppliers } from '@/entities/claim';
import { useObjects } from '@/entities/object';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Textarea } from '@/shared/ui/textarea';

const today = () => new Date().toLocaleDateString('en-CA');

type Props = {
  trigger: ReactNode;
  /** Объект задан заранее (из карточки объекта) */
  objectId?: string;
  onCreated?: (id: string) => void;
};

/** Новая рекламация: брак, недокомплект или несоответствие поставки. */
export function ClaimFormDialog({ trigger, objectId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const create = useCreateClaim();
  const suppliers = useSuppliers();
  const objects = useObjects();
  const form = useForm<ClaimCreate>({
    resolver: zodResolver(claimCreateSchema),
    defaultValues: {
      objectId: objectId ?? '',
      date: today(),
      supplier: '',
      kind: 'DEFECT',
      description: '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const claim = await create.mutateAsync(body);
      toast.success(`Рекламация №${claim.number} создана`);
      setOpen(false);
      onCreated?.(claim.id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v)
          form.reset({
            ...form.formState.defaultValues,
            objectId: objectId ?? '',
            date: today(),
          } as ClaimCreate);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая рекламация</DialogTitle>
          <DialogDescription>
            Реестр для внутреннего контроля. Письма производителю система не отправляет.
          </DialogDescription>
        </DialogHeader>
        <form id="claim-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            {!objectId && (
              <Field data-invalid={!!errors.objectId}>
                <FieldLabel htmlFor="objectId">Объект</FieldLabel>
                <Controller
                  control={form.control}
                  name="objectId"
                  render={({ field }) => (
                    <SimpleSelect
                      id="objectId"
                      value={field.value || null}
                      onChange={(v) => field.onChange(v ?? '')}
                      placeholder="Выберите объект"
                      options={(objects.data ?? []).map((o) => ({
                        value: o.id,
                        label: o.shortAddress,
                      }))}
                    />
                  )}
                />
                <FieldError errors={[errors.objectId && { message: 'Выберите объект' }]} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="kind">Причина</FieldLabel>
                <Controller
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <SimpleSelect
                      id="kind"
                      value={field.value}
                      onChange={(v) => v && field.onChange(v)}
                      options={CLAIM_KINDS.map((k) => ({ value: k, label: CLAIM_KIND_LABELS[k] }))}
                    />
                  )}
                />
              </Field>
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="date">Дата</FieldLabel>
                <Input id="date" type="date" {...form.register('date')} />
                <FieldError errors={[errors.date]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.supplier}>
              <FieldLabel htmlFor="supplier">Изготовитель / поставщик</FieldLabel>
              <Input
                id="supplier"
                list="suppliers"
                autoComplete="off"
                {...form.register('supplier')}
              />
              <datalist id="suppliers">
                {(suppliers.data ?? []).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <FieldError errors={[errors.supplier]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Что не так</FieldLabel>
              <Textarea
                id="description"
                rows={4}
                placeholder="Например: не пришли две кнопки вызова, повреждена дверь 3 этажа"
                {...form.register('description')}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button type="submit" form="claim-form" disabled={create.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
