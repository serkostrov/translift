import type { FileDto } from '@contracts';
import { Download, ExternalLink, FileImage, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/shared/lib/format';
import { formatBytes } from '@/shared/lib/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';

/** Что браузер покажет сам — открываем во вкладке, остальное скачиваем. */
const OPENABLE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function Icon({ mime }: { mime: string }) {
  const cls = 'size-5 shrink-0 text-muted-foreground';
  if (mime.startsWith('image/')) return <FileImage className={cls} />;
  if (/sheet|excel|csv/.test(mime)) return <FileSpreadsheet className={cls} />;
  return <FileText className={cls} />;
}

type Props = {
  files: FileDto[];
  /** Показать «Удалить» (руководителю) */
  onDelete?: (file: FileDto) => void;
  empty?: string;
};

/** Документы: имя, размер, кто и когда загрузил; открыть или скачать. */
export function DocumentList({ files, onDelete, empty = 'Документов пока нет' }: Props) {
  if (!files.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((f) => {
        const name = f.title || f.originalName || 'Документ';
        const openable = OPENABLE.has(f.mime);
        return (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
            <Icon mime={f.mime} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" title={name}>
                {name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {formatBytes(f.size)}
                {f.uploadedBy && ` · ${f.uploadedBy.fullName}`} · {formatDateTime(f.createdAt)}
              </div>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <a
                href={f.url}
                {...(openable
                  ? { target: '_blank', rel: 'noopener' }
                  : { download: f.originalName ?? true })}
                aria-label={openable ? `Открыть ${name}` : `Скачать ${name}`}
                title={openable ? 'Открыть' : 'Скачать'}
              >
                {openable ? <ExternalLink /> : <Download />}
              </a>
            </Button>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Удалить ${name}`}
                    title="Удалить"
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      «{name}» удалится с сервера, вернуть его будет нельзя.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction variant="danger" onClick={() => onDelete(f)}>
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        );
      })}
    </ul>
  );
}
