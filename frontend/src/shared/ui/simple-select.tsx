import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

const NONE = '__none__';
const CREATE = '__create__';

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

/** Select с поддержкой пустого значения (Radix не допускает value=""). */
export function SimpleSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  onCreate,
  createLabel = 'Создать',
  className,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <Select
      value={value ?? (noneLabel ? NONE : undefined)}
      onValueChange={(v) => {
        if (v === CREATE) {
          // Даём списку закрыться и вернуть фокус, потом открываем форму поверх
          setTimeout(() => onCreate?.(), 0);
          return;
        }
        onChange(v === NONE ? null : v);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className ?? 'w-full'} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
        {onCreate && (
          <>
            {(options.length > 0 || noneLabel) && <SelectSeparator />}
            <SelectItem value={CREATE} className="font-medium text-primary">
              <Plus />
              {createLabel}
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
