import { type BrigadeDto, type BrigadeUpsert, brigadeUpsertSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useBrigades, useDeleteBrigade, useSaveBrigade, useUsers } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { ArchiveActions } from '@/shared/ui/archive-actions';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataList } from '@/shared/ui/data-list';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';

type FormInput = z.input<typeof brigadeUpsertSchema>;

export function BrigadesTab() {
  const brigades = useBrigades();
  const [editing, setEditing] = useState<BrigadeDto | 'new' | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const all = brigades.data ?? [];
  const archived = all.filter((b) => !b.isActive).length;
  const rows = showArchive ? all.filter((b) => !b.isActive) : all.filter((b) => b.isActive);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Бригадир — пользователь с ролью «Бригадир». Он видит в телефоне объекты своей бригады.
        </p>
        <div className="flex gap-2">
          {(archived > 0 || showArchive) && (
            <Button variant="outline" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Действующие' : `Архив (${archived})`}
            </Button>
          )}
          {!showArchive && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Бригада
            </Button>
          )}
        </div>
      </div>
      <DataList
        rows={rows}
        empty={showArchive ? 'В архиве пусто' : 'Бригад пока нет'}
        rowKey={(b) => b.id}
        onRowClick={setEditing}
        columns={[
          {
            key: 'name',
            header: 'Бригада',
            mobile: 'title',
            cell: (b) => (
              <span className="font-medium">
                {b.name} {!b.isActive && <Badge variant="outline">в архиве</Badge>}
              </span>
            ),
          },
          { key: 'foreman', header: 'Бригадир', cell: (b) => b.foreman?.fullName ?? '—' },
          {
            key: 'headcount',
            header: 'Человек',
            cell: (b) => b.headcount,
            className: 'tabular-nums',
          },
          {
            key: 'objects',
            header: 'Объектов в работе',
            cell: (b) => b.activeObjects,
            className: 'tabular-nums',
          },
        ]}
      />
      {editing && (
        <BrigadeDialog
          brigade={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BrigadeDialog({ brigade, onClose }: { brigade: BrigadeDto | null; onClose: () => void }) {
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
      await save.mutateAsync({ id: brigade?.id, body });
      toast.success('Бригада сохранена');
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
            />
          )}
        />
        <FieldDescription>Нет в списке — создайте пользователя с ролью «Бригадир»</FieldDescription>
      </Field>
      <Field data-invalid={!!errors.headcount}>
        <FieldLabel htmlFor="headcount">Человек в бригаде</FieldLabel>
        <Input id="headcount" type="number" inputMode="numeric" {...form.register('headcount')} />
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
