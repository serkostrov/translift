import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { Archive, ArchiveRestore, Trash2 } from '@/shared/ui/icons';

type Props = {
  /** Сейчас в архиве */
  archived: boolean;
  /** Можно удалить совсем (нет связанных данных) */
  canDelete: boolean;
  /** Что будет при архивации — текст подтверждения */
  archiveText: string;
  /** Почему нельзя удалить, если canDelete = false */
  cannotDeleteText: string;
  /** Нельзя архивировать прямо сейчас (например, бригада на объектах) — причина */
  archiveBlocked?: string;
  onArchive: () => Promise<unknown>;
  onRestore: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  busy?: boolean;
};

type Confirm = 'archive' | 'delete' | null;

/**
 * Архив и удаление в карточке справочника. Удалить совсем можно только запись без истории
 * (заведена по ошибке); остальное — в архив: оно пропадает из списков, история остаётся.
 */
export function ArchiveActions({
  archived,
  canDelete,
  archiveText,
  cannotDeleteText,
  archiveBlocked,
  onArchive,
  onRestore,
  onDelete,
  busy,
}: Props) {
  const [confirm, setConfirm] = useState<Confirm>(null);

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="text-sm font-medium">{archived ? 'В архиве' : 'Архив и удаление'}</div>
      <p className="text-sm text-muted-foreground">
        {archived
          ? 'Не показывается в списках выбора. Вся история сохранена.'
          : (archiveBlocked ?? 'В архиве запись пропадает из списков, но история сохраняется.')}
        {!canDelete && ` ${cannotDeleteText}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {archived ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => onRestore()}>
            <ArchiveRestore />
            Вернуть из архива
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy || !!archiveBlocked}
            onClick={() => setConfirm('archive')}
          >
            <Archive />В архив
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => setConfirm('delete')}
          >
            <Trash2 />
            Удалить
          </Button>
        )}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'delete' ? 'Удалить навсегда?' : 'Отправить в архив?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? 'Запись исчезнет совсем, вернуть её будет нельзя.'
                : archiveText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === 'delete' ? 'danger' : 'default'}
              disabled={busy}
              onClick={() => (confirm === 'delete' ? onDelete() : onArchive())}
            >
              {confirm === 'delete' ? 'Удалить' : 'В архив'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
