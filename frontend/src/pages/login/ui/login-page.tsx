import { type LoginInput, loginSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';
import { useLogin, useSession } from '@/entities/session';
import { ForgotPasswordDialog } from '@/features/set-password';
import { ThemeToggle } from '@/features/theme-toggle';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { EmailInput } from '@/shared/ui/email-input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Logo } from '@/shared/ui/logo';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [forgot, setForgot] = useState(false);
  const form = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (session.data) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(from, { replace: true }),
    }),
  );

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="sr-only">Транслифт</CardTitle>
          <CardDescription className="sr-only">Монтаж лифтов</CardDescription>
          <Logo className="[&_svg]:size-11 [&_div:first-child]:text-lg" />
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="email">Почта</FieldLabel>
                <EmailInput
                  id="email"
                  autoFocus
                  autoComplete="username"
                  {...form.register('email', { onChange: () => login.reset() })}
                />
                <FieldError errors={[form.formState.errors.email]} />
              </Field>
              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register('password')}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>
              {login.isError && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage(login.error)}
                </p>
              )}
              <Button type="submit" size="lg" disabled={login.isPending}>
                {login.isPending ? 'Входим…' : 'Войти'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-muted-foreground"
                onClick={() => setForgot(true)}
              >
                Забыли пароль?
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <ForgotPasswordDialog
        open={forgot}
        onOpenChange={setForgot}
        defaultEmail={form.getValues('email')}
      />
    </div>
  );
}
