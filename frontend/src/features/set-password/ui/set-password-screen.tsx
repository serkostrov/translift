import { PASSWORD_MIN, passwordSchema, type SessionUser } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { sessionKey, useLogout } from '@/entities/session';
import { errorMessage, http } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Logo } from '@/shared/ui/logo';

const schema = z
  .object({ next: passwordSchema, repeat: z.string() })
  .refine((v) => v.next === v.repeat, { message: 'Пароли не совпадают', path: ['repeat'] });
type Values = z.infer<typeof schema>;

/**
 * Вход по временному паролю от администратора: пока сотрудник не придумает свой,
 * приложение закрыто (так же проверяет и сервер).
 */
export function SetPasswordScreen({ user }: { user: SessionUser }) {
  const qc = useQueryClient();
  const logout = useLogout();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { next: '', repeat: '' },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (next: string) => http<void>('/auth/password', { method: 'POST', body: { next } }),
    onSuccess: () =>
      qc.setQueryData<SessionUser>(sessionKey, { ...user, mustChangePassword: false }),
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3">
          <Logo className="[&_svg]:size-11 [&_div:first-child]:text-lg" />
          <div className="space-y-1">
            <CardTitle>Придумайте свой пароль</CardTitle>
            <CardDescription>
              {user.fullName}, сейчас у вас временный пароль от администратора. Замените его на свой
              — его будете знать только вы.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v.next))}>
            <FieldGroup>
              {/* Почта для менеджера паролей в браузере */}
              <input type="text" autoComplete="username" value={user.email} readOnly hidden />
              <Field data-invalid={!!errors.next}>
                <FieldLabel htmlFor="sp-next">Новый пароль</FieldLabel>
                <Input
                  id="sp-next"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  {...form.register('next')}
                />
                <FieldDescription>Не короче {PASSWORD_MIN} символов</FieldDescription>
                <FieldError errors={[errors.next]} />
              </Field>
              <Field data-invalid={!!errors.repeat}>
                <FieldLabel htmlFor="sp-repeat">Ещё раз</FieldLabel>
                <Input
                  id="sp-repeat"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('repeat')}
                />
                <FieldError errors={[errors.repeat]} />
              </Field>
              {save.isError && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage(save.error)}
                </p>
              )}
              <Button type="submit" size="lg" disabled={save.isPending}>
                {save.isPending ? 'Сохраняем…' : 'Сохранить и продолжить'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Выйти
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
