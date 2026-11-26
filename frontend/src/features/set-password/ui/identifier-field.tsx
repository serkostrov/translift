import { LOGIN_METHOD_LABELS, LOGIN_METHODS, type LoginMethod } from '@contracts';
import type { ComponentProps } from 'react';
import { Field, FieldError, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { PhoneInput } from '@/shared/ui/phone-input';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const STORAGE_KEY = 'tl-login-method';

/** Каким способом входили в прошлый раз на этом устройстве. */
export function lastLoginMethod(): LoginMethod {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (LOGIN_METHODS as readonly string[]).includes(v ?? '') ? (v as LoginMethod) : 'login';
  } catch {
    return 'login';
  }
}

export function rememberLoginMethod(method: LoginMethod) {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // приватный режим — не страшно
  }
}

const INPUTS: Record<'login' | 'email', ComponentProps<typeof Input>> = {
  login: {
    type: 'text',
    autoComplete: 'username',
    autoCapitalize: 'none',
    placeholder: 'brigadir1',
  },
  email: {
    type: 'email',
    inputMode: 'email',
    autoComplete: 'email',
    autoCapitalize: 'none',
    placeholder: 'ivanov@mail.ru',
  },
};

type Props = {
  id: string;
  method: LoginMethod;
  onMethodChange: (method: LoginMethod) => void;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: { message?: string };
  autoFocus?: boolean;
};

/**
 * Вход по логину, почте или телефону: сотрудник выбирает способ, от него зависят
 * клавиатура на телефоне, подсказка и проверка поля.
 */
export function IdentifierField({
  id,
  method,
  onMethodChange,
  value,
  onChange,
  onBlur,
  error,
  autoFocus,
}: Props) {
  return (
    <div className="space-y-3">
      <Tabs value={method} onValueChange={(v) => onMethodChange(v as LoginMethod)}>
        <TabsList className="w-full" aria-label="Чем входить">
          {LOGIN_METHODS.map((m) => (
            <TabsTrigger key={m} value={m} className="flex-1">
              {LOGIN_METHOD_LABELS[m]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={id}>{LOGIN_METHOD_LABELS[method]}</FieldLabel>
        {/* key: при смене способа поле пересоздаётся — браузер берёт новые type и autocomplete */}
        {method === 'phone' ? (
          <PhoneInput
            key={method}
            id={id}
            autoFocus={autoFocus}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
          />
        ) : (
          <Input
            key={method}
            id={id}
            autoFocus={autoFocus}
            {...INPUTS[method]}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
        <FieldError errors={[error]} />
      </Field>
    </div>
  );
}
