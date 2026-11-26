import type { ComponentProps } from 'react';
import { Input } from '@/shared/ui/input';

/** Поле почты: клавиатура с «@» на телефоне, без автозаглавной, подсказка браузера. */
export function EmailInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  return (
    <Input
      type="email"
      inputMode="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="ivanov@mail.ru"
      {...props}
    />
  );
}
