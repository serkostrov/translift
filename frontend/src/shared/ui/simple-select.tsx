import { Command } from 'cmdk';
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { CheckIcon, ChevronDownIcon, Plus, Search } from '@/shared/ui/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Подпись пустого варианта; без неё пустое значение выбрать нельзя */
  noneLabel?: string;
  /**
   * Пункт «+ Создать …» в конце списка: открывает форму создания поверх текущей.
   * Созданную запись форма выбирает сама через onChange.
   */
  onCreate?: () => void;
  createLabel?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

/** Поиск без учёта регистра и «ё»: «ивано» найдёт «г. Иваново». */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** С мышью курсор сразу в поиске; на телефоне — нет, чтобы клавиатура не закрывала список. */
const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

const ITEM =
  'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * Выбор из списка с поиском: начните печатать — список отфильтруется, можно и просто
 * пролистать. Стрелки и Enter работают. Поддерживает пустое значение и «+ Создать».
 */
export function SimpleSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Выберите',
  noneLabel,
  onCreate,
  createLabel = 'Создать',
  className,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = query ? options.filter((o) => norm(o.label).includes(norm(query))) : options;

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <Popover
      // modal: внутри окна (Dialog) поле поиска иначе не получает фокус
      modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQuery('');
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          data-placeholder={!selected && !(noneLabel && !value) ? '' : undefined}
          className={cn(
            'flex h-8 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50',
            className ?? 'w-full',
          )}
        >
          <span className="line-clamp-1 min-w-0">
            {selected?.label ?? (noneLabel && !value ? noneLabel : placeholder)}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 gap-0 p-0"
        onOpenAutoFocus={(e) => {
          if (!finePointer()) e.preventDefault();
        }}
      >
        {/* Фильтруем сами (по вхождению), cmdk — для клавиатуры и доступности */}
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b px-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Поиск…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto overscroll-contain p-1">
            {shown.length === 0 && (
              <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
            {noneLabel && !query && (
              <Command.Item value="__none__" onSelect={() => pick(null)} className={ITEM}>
                <span className="text-muted-foreground">{noneLabel}</span>
                {!value && <CheckIcon className="absolute right-2" />}
              </Command.Item>
            )}
            {shown.map((o) => (
              <Command.Item
                key={o.value}
                value={o.value}
                onSelect={() => pick(o.value)}
                className={ITEM}
              >
                <span className="line-clamp-2">{o.label}</span>
                {o.value === value && <CheckIcon className="absolute right-2" />}
              </Command.Item>
            ))}
            {onCreate && (
              <>
                <div className="-mx-1 my-1 h-px bg-border" />
                <Command.Item
                  value="__create__"
                  onSelect={() => {
                    setOpen(false);
                    // Даём списку закрыться и вернуть фокус, потом открываем форму поверх
                    setTimeout(() => onCreate(), 0);
                  }}
                  className={cn(ITEM, 'font-medium text-primary')}
                >
                  <Plus />
                  {createLabel}
                </Command.Item>
              </>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
