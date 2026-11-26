import { type ReactNode, useId } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { FieldGroup } from '@/shared/ui/field';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
  children: ReactNode;
  /**
   * Вложенные диалоги (создание записи из селекта). Рендерятся внутри окна, но вне формы:
   * так Radix считает их дочерним слоем (клик в них не закрывает это окно),
   * а submit вложенной формы не всплывает в эту.
   */
  nested?: ReactNode;
};

/** Диалог формы справочника: заголовок, поля, «Отмена / Сохранить». */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  submitting,
  submitLabel = 'Сохранить',
  children,
  nested,
}: Props) {
  // Окна бывают открыты одно поверх другого — id формы у каждого свой
  const formId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          id={formId}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSubmit();
          }}
        >
          <FieldGroup className="gap-4">{children}</FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="submit" form={formId} disabled={submitting}>
            {submitLabel}
          </Button>
        </DialogFooter>
        {nested}
      </DialogContent>
    </Dialog>
  );
}
