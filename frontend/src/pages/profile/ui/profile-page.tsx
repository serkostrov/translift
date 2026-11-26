import {
  formatPhone,
  type PasswordChange,
  type ProfileDto,
  type ProfileUpdate,
  passwordChangeSchema,
  profileUpdateSchema,
  ROLE_LABELS,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  FileSpreadsheet,
  HardDrive,
  LogOut,
  type LucideIcon,
  MonitorSmartphone,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { hasRole, sessionKey, useCurrentUser, useLogout } from '@/entities/session';
import { InstallHint } from '@/features/pwa';
import { ThemeToggle } from '@/features/theme-toggle';
import { errorMessage, http } from '@/shared/api/http';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PhoneInput } from '@/shared/ui/phone-input';
import { BlockSkeleton } from '@/shared/ui/skeletons';

const profileKey = ['profile'] as const;

export function ProfilePage() {
  const profile = useQuery({
    queryKey: profileKey,
    queryFn: () => http<ProfileDto>('/auth/profile'),
  });

  if (profile.isPending) return <BlockSkeleton lines={5} />;
  if (profile.isError) return <p className="text-destructive">{errorMessage(profile.error)}</p>;
  const p = profile.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <p className="text-sm text-muted-foreground">
          {p.login} · {ROLE_LABELS[p.role]}
          {p.brigade && ` · ${p.brigade.name}`}
        </p>
      </div>
      <InstallHint />
      <MoreSections />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileForm profile={p} />
        <PasswordForm />
      </div>
      <SessionCard profile={p} />
    </div>
  );
}

/** На телефоне: разделы, которых нет в нижнем меню. */
function MoreSections() {
  const user = useCurrentUser();
  const items: { to: string; label: string; icon: LucideIcon; show: boolean }[] = [
    { to: '/notifications', label: 'Уведомления', icon: Bell, show: true },
    { to: '/reports', label: 'Отчёты', icon: FileSpreadsheet, show: !hasRole(user, 'FOREMAN') },
    { to: '/users', label: 'Пользователи', icon: Users, show: hasRole(user, 'ADMIN') },
    { to: '/storage', label: 'Хранилище', icon: HardDrive, show: hasRole(user, 'ADMIN') },
  ];
  return (
    <Card className="gap-0 py-1 md:hidden">
      {items
        .filter((i) => i.show)
        .map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 active:bg-muted">
            <Icon className="size-5 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex-1 text-muted-foreground">Тема оформления</span>
        <ThemeToggle />
      </div>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: ProfileDto }) {
  const qc = useQueryClient();
  const form = useForm<ProfileUpdate, unknown, z.output<typeof profileUpdateSchema>>({
    resolver: zodResolver(profileUpdateSchema),
  });
  const { errors, isDirty } = form.formState;
  useEffect(() => {
    form.reset({
      fullName: profile.fullName,
      email: profile.email ?? '',
      phone: profile.phone ? formatPhone(profile.phone) : '',
    });
  }, [profile, form]);

  const save = useMutation({
    mutationFn: (body: z.output<typeof profileUpdateSchema>) =>
      http<ProfileDto>('/auth/profile', { method: 'PATCH', body }),
    onSuccess: (p) => {
      qc.setQueryData(profileKey, p);
      qc.invalidateQueries({ queryKey: sessionKey });
      toast.success('Профиль сохранён');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Личные данные</CardTitle>
        <CardDescription>
          Входить можно по логину, телефону или почте. Логин и роль меняет администратор.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit((b) => save.mutate(b))}>
          <Field data-invalid={!!errors.fullName}>
            <FieldLabel htmlFor="p-name">ФИО</FieldLabel>
            <Input id="p-name" autoComplete="name" {...form.register('fullName')} />
            <FieldError errors={[errors.fullName]} />
          </Field>
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="p-phone">Телефон</FieldLabel>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="p-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <FieldError errors={[errors.phone]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="p-email">Почта</FieldLabel>
            <Input
              id="p-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="ivanov@mail.ru"
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Button type="submit" disabled={!isDirty || save.isPending}>
            Сохранить
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const form = useForm<PasswordChange>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current: '', next: '' },
  });
  const { errors } = form.formState;
  const change = useMutation({
    mutationFn: (body: PasswordChange) => http<void>('/auth/password', { method: 'POST', body }),
    onSuccess: () => {
      form.reset();
      toast.success('Пароль изменён. На других устройствах нужно войти заново');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Смена пароля</CardTitle>
        <CardDescription>После смены остальные устройства выйдут из системы.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((b) => change.mutate(b))}
        >
          <Field data-invalid={!!errors.current}>
            <FieldLabel htmlFor="p-cur">Текущий пароль</FieldLabel>
            <Input
              id="p-cur"
              type="password"
              autoComplete="current-password"
              {...form.register('current')}
            />
            <FieldError errors={[errors.current]} />
          </Field>
          <Field data-invalid={!!errors.next}>
            <FieldLabel htmlFor="p-new">Новый пароль</FieldLabel>
            <Input
              id="p-new"
              type="password"
              autoComplete="new-password"
              {...form.register('next')}
            />
            <FieldError errors={[errors.next]} />
          </Field>
          <Button type="submit" variant="outline" disabled={change.isPending}>
            Сменить пароль
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionCard({ profile }: { profile: ProfileDto }) {
  const qc = useQueryClient();
  const logout = useLogout();
  const navigate = useNavigate();
  const others = useMutation({
    mutationFn: () => http<void>('/auth/logout-others', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKey });
      toast.success('Другие устройства вышли из системы');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Вход в систему</CardTitle>
        <CardDescription>
          {profile.sessions > 1
            ? `Вы вошли на ${profile.sessions} устройствах.`
            : 'Вы вошли только на этом устройстве.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {profile.sessions > 1 && (
          <Button variant="outline" onClick={() => others.mutate()} disabled={others.isPending}>
            <MonitorSmartphone />
            Выйти на других устройствах
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="danger">
              <LogOut />
              Выйти из системы
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Выйти из системы?</AlertDialogTitle>
              <AlertDialogDescription>
                Чтобы снова работать, понадобится ввести логин и пароль.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Остаться</AlertDialogCancel>
              <AlertDialogAction
                variant="danger"
                onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
              >
                Выйти
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
