import {
  ROLE_LABELS,
  ROLES,
  type Role,
  type UserCreate,
  type UserWithPassword,
  userCreateSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field';
import { FormDialog } from '@/shared/ui/form-dialog';
import { Input } from '@/shared/ui/input';
import { PhoneInput } from '@/shared/ui/phone-input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { useCreateUser } from '../api/refs';

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

/**
 * Новый сотрудник. Пароль можно не задавать — сервер придумает временный.
 * `fixedRole` — сотрудник заводится сразу с этой ролью (например, бригадир из формы бригады).
 */
export function CreateUserDialog({
  onClose,
  onCreated,
  fixedRole,
}: {
  onClose: () => void;
  onCreated: (r: UserWithPassword) => void;
  fixedRole?: Role;
}) {
  const create = useCreateUser();
  // mutateAsync, а не колбэки mutate: список обновляется сразу и может размонтировать форму
  // раньше ответа — временный пароль нельзя потерять
  const form = useForm<UserCreate, unknown, z.output<typeof userCreateSchema>>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      login: '',
      fullName: '',
      email: '',
      phone: '',
      role: fixedRole ?? 'FOREMAN',
      password: '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((body) =>
    create.mutateAsync(body).then(onCreated, (e) => toast.error(errorMessage(e))),
  );

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={
        fixedRole ? `Новый сотрудник: ${ROLE_LABELS[fixedRole].toLowerCase()}` : 'Новый сотрудник'
      }
      onSubmit={onSubmit}
      submitting={create.isPending}
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
                disabled={!!fixedRole}
              />
            )}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">Телефон</FieldLabel>
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <FieldError errors={[errors.phone]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Почта</FieldLabel>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            placeholder="ivanov@mail.ru"
            {...form.register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>
      </div>
      <FieldDescription>
        Войти можно по логину, телефону или почте — любому из них.
      </FieldDescription>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="password">Пароль</FieldLabel>
        <Input
          id="password"
          type="text"
          autoComplete="off"
          placeholder="Пусто — придумаем сами"
          {...form.register('password')}
        />
        <FieldDescription>
          Пароль временный: при первом входе сотрудник придумает свой.
        </FieldDescription>
        <FieldError errors={[errors.password]} />
      </Field>
    </FormDialog>
  );
}

/** Логин и временный пароль: показываются один раз, дальше их не узнать. */
export function PasswordIssuedDialog({
  issued,
  onClose,
}: {
  issued: UserWithPassword;
  onClose: () => void;
}) {
  const { user, password } = issued;
  const text = [
    `Транслифт: ${window.location.origin}`,
    `Логин: ${user.login}`,
    `Пароль: ${password}`,
    'При входе система попросит придумать свой пароль.',
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch {
      toast.error('Не удалось скопировать — перепишите вручную');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Данные для входа</DialogTitle>
          <DialogDescription>
            {user.fullName}. Пароль показывается один раз — передайте его сотруднику лично или по
            телефону.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 rounded-lg bg-muted p-4">
          <dt className="text-sm text-muted-foreground">Логин</dt>
          <dd className="font-mono text-lg break-all">{user.login}</dd>
          <dt className="text-sm text-muted-foreground">Пароль</dt>
          <dd className="font-mono text-lg font-semibold tracking-wide break-all select-all">
            {password}
          </dd>
        </dl>
        <p className="text-sm text-muted-foreground">
          При первом входе система попросит сотрудника придумать свой пароль.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy />
            Скопировать
          </Button>
          <Button onClick={onClose}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
