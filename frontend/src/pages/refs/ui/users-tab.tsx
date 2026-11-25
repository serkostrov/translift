import {
  ROLE_LABELS,
  ROLES,
  type UserCreate,
  type UserDto,
  type UserUpdate,
  userCreateSchema,
  userUpdateSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useSaveUser, useUsers } from '@/entities/refs';
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

export function UsersTab() {
  const users = useUsers();
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          У каждого сотрудника свой логин. Бригадира привяжите к бригаде во вкладке «Бригады».
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Пользователь
        </Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Логин</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Бригада</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setEditing(u)}>
                <TableCell className="font-medium">
                  {u.fullName} {!u.isActive && <Badge variant="outline">отключён</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{u.login}</TableCell>
                <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                <TableCell>{u.brigade?.name ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editing === 'new' && <CreateUserDialog onClose={() => setEditing(null)} />}
      {editing && editing !== 'new' && (
        <EditUserDialog user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const save = useSaveUser();
  const form = useForm<UserCreate>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { login: '', fullName: '', phone: '', role: 'FOREMAN', password: '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ body });
      toast.success('Пользователь создан');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Новый пользователь"
      onSubmit={onSubmit}
      submitting={save.isPending}
    >
      <Field data-invalid={!!errors.fullName}>
        <FieldLabel htmlFor="fullName">ФИО</FieldLabel>
        <Input id="fullName" {...form.register('fullName')} />
        <FieldError errors={[errors.fullName]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={!!errors.login}>
          <FieldLabel htmlFor="login">Логин</FieldLabel>
          <Input id="login" autoCapitalize="none" autoComplete="off" {...form.register('login')} />
          <FieldError errors={[errors.login]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="role">Роль</FieldLabel>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <SimpleSelect
                id="role"
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                options={roleOptions}
              />
            )}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="phone">Телефон</FieldLabel>
        <Input id="phone" type="tel" {...form.register('phone')} />
      </Field>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="password">Пароль</FieldLabel>
        <Input
          id="password"
          type="text"
          autoComplete="new-password"
          {...form.register('password')}
        />
        <FieldDescription>Передайте сотруднику лично</FieldDescription>
        <FieldError errors={[errors.password]} />
      </Field>
    </FormDialog>
  );
}

function EditUserDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const save = useSaveUser();
  const form = useForm<UserUpdate & { password?: string }>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone ?? '',
      role: user.role,
      isActive: user.isActive,
      password: undefined,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await save.mutateAsync({ id: user.id, body });
      toast.success('Сохранено');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={user.fullName}
      description={`Логин: ${user.login}`}
      onSubmit={onSubmit}
      submitting={save.isPending}
    >
      <Field data-invalid={!!errors.fullName}>
        <FieldLabel htmlFor="fullName">ФИО</FieldLabel>
        <Input id="fullName" {...form.register('fullName')} />
        <FieldError errors={[errors.fullName]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="role">Роль</FieldLabel>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <SimpleSelect
                id="role"
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                options={roleOptions}
              />
            )}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="phone">Телефон</FieldLabel>
          <Input id="phone" type="tel" {...form.register('phone')} />
        </Field>
      </div>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="password">Новый пароль</FieldLabel>
        <Input
          id="password"
          type="text"
          autoComplete="new-password"
          placeholder="Оставьте пустым, чтобы не менять"
          {...form.register('password', { setValueAs: (v) => v || undefined })}
        />
        <FieldDescription>
          После смены пароля сотрудника выкинет из системы на всех устройствах
        </FieldDescription>
        <FieldError errors={[errors.password]} />
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
        <FieldLabel htmlFor="isActive">Доступ разрешён</FieldLabel>
      </Field>
    </FormDialog>
  );
}
