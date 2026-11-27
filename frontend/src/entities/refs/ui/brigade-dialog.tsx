import {
  type BrigadeDto,
  type BrigadeUpsert,
  brigadeUpsertSchema,
  type UserWithPassword,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessage } from '@/shared/api/http';
import { ArchiveActions } from '@/shared/ui/archive-actions';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { NumberInput } from '@/shared/ui/number-input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { useBrigades, useDeleteBrigade, useSaveBrigade, useUsers } from '../api/refs';
import { CreateUserDialog, PasswordIssuedDialog } from './user-dialogs';

type FormInput = z.input<typeof brigadeUpsertSchema>;

/**
 * Бригада: создание, правка, архив. Администратор может завести бригадира прямо отсюда
 * (`canCreateForeman`) — откроется форма сотрудника поверх, потом окно с паролем.
 */
export function BrigadeDialog({
  brigade,
  onClose,
  onSaved,
  canCreateForeman,
}: {
  brigade: BrigadeDto | null;
  onClose: () => void;
  onSaved?: (brigade: BrigadeDto) => void;
  canCreateForeman?: boolean;
}) {
  const save = useSaveBrigade();
  const remove = useDeleteBrigade();
  const foremen = useUsers('FOREMAN');
  const brigades = useBrigades();
  const taken = new Set(
    (brigades.data ?? []).filter((b) => b.id !== brigade?.id).map((b) => b.foreman?.id),
  );
  const form = useForm<FormInput, unknown, BrigadeUpsert>({
    resolver: zodResolver(brigadeUpsertSchema),
    defaultValues: {
      name: brigade?.name ?? '',
      headcount: brigade?.headcount ?? 3,
      foremanId: brigade?.foreman?.id ?? null,
    },
  });
  const { errors } = form.formState;
  const [creatingForeman, setCreatingForeman] = useState(false);
  const [issued, setIssued] = useState<UserWithPassword | null>(null);

  const act = (p: Promise<unknown>, done: string) =>
    p.then(
      () => {
        toast.success(done);
        onClose();
      },
      (e) => toast.error(errorMessage(e)),
    );

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const saved = await save.mutateAsync({ id: brigade?.id, body });
      toast.success(brigade ? 'Бригада сохранена' : 'Бригада добавлена');
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
      title={brigade ? 'Бригада' : 'Новая бригада'}
      onSubmit={onSubmit}
      submitting={save.isPending}
      nested={
        <>
          {creatingForeman && (
            <CreateUserDialog
              fixedRole="FOREMAN"
              onClose={() => setCreatingForeman(false)}
              onCreated={(r) => {
                setCreatingForeman(false);
                form.setValue('foremanId', r.user.id);
                setIssued(r);
              }}
            />
          )}
          {issued && <PasswordIssuedDialog issued={issued} onClose={() => setIssued(null)} />}
        </>
      }
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="name">Название</FieldLabel>
        <Input id="name" placeholder="Бригада Смирнова" {...form.register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="foremanId">Бригадир</FieldLabel>
        <Controller
          control={form.control}
          name="foremanId"
          render={({ field }) => (
            <SimpleSelect
              id="foremanId"
              value={field.value}
              onChange={field.onChange}
              noneLabel="Не назначен"
              options={(foremen.data ?? [])
                .filter((u) => u.isActive && !taken.has(u.id))
                .map((u) => ({ value: u.id, label: u.fullName }))}
              onCreate={canCreateForeman ? () => setCreatingForeman(true) : undefined}
              createLabel="Новый бригадир"
            />
          )}
        />
        {!canCreateForeman && (
          <FieldDescription>
            Нет в списке — попросите администратора завести бригадира
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={!!errors.headcount}>
        <FieldLabel htmlFor="headcount">Человек в бригаде</FieldLabel>
        <NumberInput id="headcount" min={1} {...form.register('headcount')} />
        <FieldError errors={[errors.headcount]} />
      </Field>
      {brigade && (
        <ArchiveActions
          archived={!brigade.isActive}
          canDelete={brigade.canDelete}
          busy={save.isPending || remove.isPending}
          archiveBlocked={
            brigade.activeObjects > 0
              ? `В архив нельзя: на бригаде ${brigade.activeObjects} об. в работе — сначала назначьте их другой бригаде.`
              : undefined
          }
          archiveText="Бригада пропадёт из выбора при назначении объектов. Сданные объекты и отчёты останутся с ней."
          cannotDeleteText="Удалить нельзя: у бригады есть объекты в истории."
          onArchive={() =>
            act(save.mutateAsync({ id: brigade.id, body: { isActive: false } }), 'Бригада в архиве')
          }
          onRestore={() =>
            act(
              save.mutateAsync({ id: brigade.id, body: { isActive: true } }),
              'Бригада снова в работе',
            )
          }
          onDelete={() => act(remove.mutateAsync(brigade.id), 'Бригада удалена')}
        />
      )}
    </FormDialog>
  );
}
