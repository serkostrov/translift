import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const NONE = '__none__';

export type SelectOption = { value: string; label: string };

type Props = {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  /** Подпись пустого варианта; без неё пустое значение выбрать нельзя */
  noneLabel?: string;
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
  className,
  disabled,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <Select
      value={value ?? (noneLabel ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
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
      </SelectContent>
    </Select>
  );
}
