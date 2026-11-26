import {
  type LoginMethod,
  type PasswordResetRequest,
  passwordResetRequestSchema,
} from '@contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { useController, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { errorMessage, http } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { IdentifierField } from './identifier-field';

/**
 * «Забыли пароль?»: почты и СМС нет, запрос уходит администраторам — они видят его
 * в уведомлениях и выдают новый временный пароль.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultMethod,
  defaultValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMethod: LoginMethod;
  defaultValue: string;
}) {
  const form = useForm<PasswordResetRequest, unknown, z.output<typeof passwordResetRequestSchema>>({
    resolver: zodResolver(passwordResetRequestSchema),
    values: { method: defaultMethod, value: defaultValue },
  });
  const method = form.watch('method');
  const value = useController({ control: form.control, name: 'value' });
  const send = useMutation({
    mutationFn: (body: PasswordResetRequest) =>
      http<void>('/auth/password-reset-request', { method: 'POST', body }),
  });

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) send.reset();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        {send.isSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Запрос отправлен
              </DialogTitle>
              <DialogDescription>
                Администратор увидит его и выдаст новый временный пароль — обычно звонит или пишет
                лично. Если срочно, позвоните ему сами.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => close(false)}>Понятно</Button>
            </DialogFooter>
          </>
        ) : (
          <form noValidate onSubmit={form.handleSubmit((b) => send.mutate(b))}>
            <DialogHeader>
              <DialogTitle>Забыли пароль?</DialogTitle>
              <DialogDescription>
                Укажите логин, почту или телефон — администратор получит запрос и выдаст новый
                пароль.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4">
              <IdentifierField
                id="fp-value"
                method={method}
                onMethodChange={(m) => {
                  form.setValue('method', m);
                  form.setValue('value', '');
                  form.clearErrors('value');
                }}
                value={value.field.value}
                onChange={value.field.onChange}
                onBlur={value.field.onBlur}
                error={form.formState.errors.value}
              />
            </div>
            {send.isError && (
              <p className="mb-3 text-sm text-destructive" role="alert">
                {errorMessage(send.error)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={send.isPending}>
                Отправить запрос
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
