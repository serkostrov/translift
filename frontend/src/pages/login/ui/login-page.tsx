import { type LoginInput, loginSchema } from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useLogin, useSession } from '@/entities/session';
import { ThemeToggle } from '@/features/theme-toggle';
import { errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Logo } from '@/shared/ui/logo';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: '', password: '' },
  });

  if (session.data) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) }),
  );

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="sr-only">Транслифт</CardTitle>
          <CardDescription className="sr-only">Контроль монтажа лифтов</CardDescription>
          <Logo className="[&_svg]:size-11 [&_div:first-child]:text-lg" />
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.login}>
                <FieldLabel htmlFor="login">Логин</FieldLabel>
                <Input
                  id="login"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  {...form.register('login')}
                />
                <FieldError errors={[form.formState.errors.login]} />
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
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
