import {
  formatPhone,
  ROLE_LABELS,
  ROLES,
  type Role,
  type UserCreate,
  type UserDto,
  type UserUpdate,
  type UserWithPassword,
  userCreateSchema,
  userUpdateSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, KeyRound, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  useCreateUser,
  useDeleteUser,
  useDismissResetRequest,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from '@/entities/refs';
import { useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { ArchiveActions } from '@/shared/ui/archive-actions';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { DataList } from '@/shared/ui/data-list';
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
import { ListSkeleton } from '@/shared/ui/skeletons';

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

/**
 * Пользователи: администратор заводит сотрудников, выдаёт логины и временные пароли,
 * сбрасывает забытые пароли и отключает доступ уволенным.
 */
export function UsersPage() {
  const users = useUsers();
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null);
  const [issued, setIssued] = useState<UserWithPassword | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const all = users.data ?? [];
  const me = useCurrentUser();
  // Свой пароль администратор меняет в профиле — себя в блоке запросов не показываем
  const requests = all.filter((u) => u.resetRequestedAt && u.isActive && u.id !== me.id);
  const archived = all.filter((u) => !u.isActive).length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return all.filter(
      (u) =>
        u.isActive !== showArchive &&
        (!role || u.role === role) &&
        (!q ||
          u.fullName.toLowerCase().includes(q) ||
          u.login.includes(q) ||
          u.email?.includes(q) ||
          (digits.length >= 3 && u.phone?.includes(digits))),
    );
  }, [all, query, role, showArchive]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Пользователи</h1>
          <p className="text-sm text-muted-foreground">
            Входят по логину, почте или телефону. Бригадира привяжите к бригаде в «Справочниках».
          </p>
        </div>
        <div className="flex gap-2">
          {(archived > 0 || showArchive) && (
            <Button variant="outline" onClick={() => setShowArchive((v) => !v)}>
              {showArchive ? 'Действующие' : `Архив (${archived})`}
            </Button>
          )}
          {!showArchive && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Сотрудник
            </Button>
          )}
        </div>
      </div>

      {!showArchive && requests.length > 0 && (
        <ResetRequests users={requests} onIssued={setIssued} onOpen={setEditing} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="ФИО, логин, почта или телефон"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск"
          />
        </div>
        <SimpleSelect
          className="sm:w-52"
          value={role}
          onChange={(v) => setRole(v as Role | null)}
          options={roleOptions}
          noneLabel="Все роли"
          placeholder="Все роли"
          aria-label="Роль"
        />
      </div>

      {users.isPending ? (
        <ListSkeleton rows={6} />
      ) : (
        <DataList
          rows={rows}
          rowKey={(u) => u.id}
          onRowClick={setEditing}
          empty={showArchive ? 'В архиве пусто' : 'Никого не нашли'}
          columns={[
            {
              key: 'name',
              header: 'ФИО',
              mobile: 'title',
              cell: (u) => (
                <span className="flex flex-wrap items-center gap-1.5 font-medium">
                  <span className={u.isActive ? undefined : 'text-muted-foreground'}>
                    {u.fullName}
                  </span>
                  <UserBadges user={u} />
                </span>
              ),
            },
            {
              key: 'role',
              header: 'Роль',
              mobile: 'aside',
              cell: (u) => <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>,
            },
            {
              key: 'login',
              header: 'Логин',
              cell: (u) => (
                <span className="font-mono text-sm text-muted-foreground">{u.login}</span>
              ),
            },
            {
              key: 'contacts',
              header: 'Контакты',
              cell: (u) =>
                u.email || u.phone ? (
                  <span className="flex flex-col text-sm">
                    {u.phone && (
                      <span className="whitespace-nowrap tabular-nums">{formatPhone(u.phone)}</span>
                    )}
                    {u.email && <span className="break-all text-muted-foreground">{u.email}</span>}
                  </span>
                ) : (
                  '—'
                ),
            },
            { key: 'brigade', header: 'Бригада', cell: (u) => u.brigade?.name ?? '—' },
            {
              key: 'last',
              header: 'Последний вход',
              cell: (u) => (
                <span className="text-muted-foreground">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'ещё не входил'}
                </span>
              ),
            },
          ]}
        />
      )}

      {editing === 'new' && (
        <CreateUserDialog
          onClose={() => setEditing(null)}
          onCreated={(r) => {
            setEditing(null);
            setIssued(r);
          }}
        />
      )}
      {editing && editing !== 'new' && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onIssued={(r) => {
            setEditing(null);
            setIssued(r);
          }}
        />
      )}
      {issued && <PasswordIssuedDialog issued={issued} onClose={() => setIssued(null)} />}
    </div>
  );
}

function UserBadges({ user }: { user: UserDto }) {
  return (
    <>
      {!user.isActive && <Badge variant="outline">в архиве</Badge>}
      {user.isActive && user.resetRequestedAt && (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">просит пароль</Badge>
      )}
      {user.isActive && !user.resetRequestedAt && user.mustChangePassword && (
        <Badge variant="outline">временный пароль</Badge>
      )}
    </>
  );
}

/** Сотрудники, нажавшие «Забыли пароль?»: выдать новый — одна кнопка. */
function ResetRequests({
  users,
  onIssued,
  onOpen,
}: {
  users: UserDto[];
  onIssued: (r: UserWithPassword) => void;
  onOpen: (u: UserDto) => void;
}) {
  const reset = useResetPassword();
  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="size-4 text-amber-600" />
          Просят новый пароль
        </CardTitle>
        <CardDescription>
          Перед выдачей убедитесь, что это действительно сотрудник: позвоните ему.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(u)}>
              <div className="font-medium">{u.fullName}</div>
              <div className="text-sm text-muted-foreground">
                {u.login} · {ROLE_LABELS[u.role]}
                {u.phone && ` · ${formatPhone(u.phone)}`} · {formatDateTime(u.resetRequestedAt)}
              </div>
            </button>
            <Button
              size="sm"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutateAsync(u.id).then(onIssued, (e) => toast.error(errorMessage(e)))
              }
            >
              Выдать новый пароль
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: UserWithPassword) => void;
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
      role: 'FOREMAN',
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
      title="Новый сотрудник"
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

function EditUserDialog({
  user,
  onClose,
  onIssued,
}: {
  user: UserDto;
  onClose: () => void;
  onIssued: (r: UserWithPassword) => void;
}) {
  const me = useCurrentUser();
  const isMe = me.id === user.id;
  const save = useUpdateUser();
  const reset = useResetPassword();
  const [confirmReset, setConfirmReset] = useState(false);
  const remove = useDeleteUser();
  const dismiss = useDismissResetRequest();
  const form = useForm<UserUpdate, unknown, z.output<typeof userUpdateSchema>>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      login: user.login,
      fullName: user.fullName,
      email: user.email ?? '',
      phone: user.phone ? formatPhone(user.phone) : '',
      role: user.role,
    },
  });
  const act = (p: Promise<unknown>, done: string) =>
    p.then(
      () => {
        toast.success(done);
        onClose();
      },
      (e) => toast.error(errorMessage(e)),
    );
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((body) =>
    save.mutate(
      { id: user.id, body },
      {
        onSuccess: () => {
          toast.success('Сохранено');
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  );

  return (
    <>
      <FormDialog
        open={!confirmReset}
        onOpenChange={(v) => !v && onClose()}
        title={user.fullName}
        description={
          user.lastLoginAt
            ? `Последний вход: ${formatDateTime(user.lastLoginAt)}`
            : 'Ещё ни разу не входил'
        }
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
            <Input
              id="login"
              autoCapitalize="none"
              autoComplete="off"
              {...form.register('login')}
            />
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
                  disabled={isMe}
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
        <div
          className={cn(
            'rounded-lg border p-3',
            user.resetRequestedAt && 'border-amber-500/50 bg-amber-500/5',
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            {user.resetRequestedAt && <KeyRound className="size-4 text-amber-600" />}
            {user.resetRequestedAt
              ? `Просит новый пароль · ${formatDateTime(user.resetRequestedAt)}`
              : 'Пароль'}
          </div>
          {user.resetRequestedAt && (
            <p className="mb-3 text-sm text-muted-foreground">
              {isMe
                ? 'Запрос от вашего логина. Если вы вошли — смените пароль в профиле, запрос закроется сам. Или отклоните его.'
                : 'Нажал «Забыли пароль?» на экране входа. Позвоните сотруднику и убедитесь, что запрос от него. Не от него или пароль вспомнил — отклоните.'}
            </p>
          )}
          {isMe ? (
            user.resetRequestedAt ? (
              <Button
                type="button"
                variant="outline"
                disabled={dismiss.isPending}
                onClick={() => act(dismiss.mutateAsync(user.id), 'Запрос отклонён')}
              >
                Отклонить запрос
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Свой пароль меняйте в профиле.</p>
            )
          ) : user.resetRequestedAt ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setConfirmReset(true)}>
                <KeyRound />
                Выдать новый пароль
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={dismiss.isPending}
                onClick={() => act(dismiss.mutateAsync(user.id), 'Запрос отклонён')}
              >
                Отклонить
              </Button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Забыл пароль — выдайте новый временный. Сотрудник выйдет из системы на всех
                устройствах.
              </p>
              <Button type="button" variant="outline" onClick={() => setConfirmReset(true)}>
                <KeyRound />
                Сбросить пароль
              </Button>
            </>
          )}
        </div>
        {!isMe && (
          <ArchiveActions
            archived={!user.isActive}
            canDelete={user.canDelete}
            busy={save.isPending || remove.isPending}
            archiveText={`${user.fullName} сразу выйдет из системы и не сможет войти.${
              user.brigade ? ` Бригада «${user.brigade.name}» останется без бригадира.` : ''
            } Отметки, фото и история сохранятся.`}
            cannotDeleteText="Удалить нельзя: у сотрудника есть отметки, фото или записи в журнале."
            onArchive={() =>
              act(
                save.mutateAsync({ id: user.id, body: { isActive: false } }),
                'Сотрудник в архиве',
              )
            }
            onRestore={() =>
              act(save.mutateAsync({ id: user.id, body: { isActive: true } }), 'Доступ возвращён')
            }
            onDelete={() => act(remove.mutateAsync(user.id), 'Сотрудник удалён')}
          />
        )}
      </FormDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить пароль?</AlertDialogTitle>
            <AlertDialogDescription>
              {user.fullName} выйдет из системы на всех устройствах. Старый пароль перестанет
              работать, войти можно будет только с новым временным.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={reset.isPending}
              onClick={() =>
                reset.mutateAsync(user.id).then(onIssued, (e) => toast.error(errorMessage(e)))
              }
            >
              Сбросить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Логин и временный пароль: показываются один раз, дальше их не узнать. */
function PasswordIssuedDialog({
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
