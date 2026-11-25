import { type BrigadeDto, type BrigadeUpsert, brigadeUpsertSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { useBrigades, useSaveBrigade, useUsers } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { FormDialog } from './form-dialog';

type FormInput = z.input<typeof brigadeUpsertSchema>;

export function BrigadesTab() {
  const brigades = useBrigades();
  const [editing, setEditing] = useState<BrigadeDto | 'new' | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Бригадир — пользователь с ролью «Бригадир». Он видит в телефоне объекты своей бригады.
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Бригада
        </Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Бригада</TableHead>
              <TableHead>Бригадир</TableHead>
              <TableHead>Человек</TableHead>
              <TableHead>Объектов в работе</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(brigades.data ?? []).map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => setEditing(b)}>
                <TableCell className="font-medium">
                  {b.name} {!b.isActive && <Badge variant="outline">не активна</Badge>}
                </TableCell>
                <TableCell>{b.foreman?.fullName ?? '—'}</TableCell>
                <TableCell className="tabular-nums">{b.headcount}</TableCell>
                <TableCell className="tabular-nums">{b.activeObjects}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
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
      isActive: brigade?.isActive ?? true,
    },
  });
  const { errors } = form.formState;

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
      <Field orientation="horizontal">
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Checkbox
              id="isActive"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          )}
        />
        <FieldLabel htmlFor="isActive">Активна</FieldLabel>
      </Field>
    </FormDialog>
  );
}
