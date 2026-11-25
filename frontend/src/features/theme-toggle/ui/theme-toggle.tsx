import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

const OPTIONS = [
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'system', label: 'Системная', icon: Monitor },
] as const;

/** Переключатель темы: тёмная, светлая или системная. Выбор запоминается в браузере. */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { theme = 'system', setTheme, resolvedTheme } = useTheme();
  // До монтирования тема неизвестна — не мигаем иконкой
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Icon = !mounted ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={withLabel ? 'sm' : 'icon'}
          className={withLabel ? '-ml-2' : undefined}
          aria-label="Тема оформления"
        >
          <Icon />
          {withLabel && 'Тема'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {OPTIONS.map(({ value, label, icon: ItemIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <ItemIcon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
