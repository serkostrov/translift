import type { FileDto } from '@contracts';
import { useState } from 'react';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { ChevronLeft, ChevronRight, Download, ExternalLink } from '@/shared/ui/icons';

type ViewerProps = {
  photos: FileDto[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  caption?: (p: FileDto) => string;
};

/** Имя файла при скачивании: исходное имя или «Транслифт_дата.jpg». */
function fileName(p: FileDto) {
  if (p.originalName) return p.originalName;
  const d = new Date(p.takenAt ?? p.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Транслифт_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.jpg`;
}

/**
 * Просмотр фото во весь экран с листанием.
 * «Скачать» сохраняет файл на телефон, «Открыть» — оригинал в новой вкладке,
 * где его можно увеличить пальцами.
 */
export function PhotoViewer({ photos, index, onIndexChange, caption }: ViewerProps) {
  const photo = index === null ? null : photos[index];
  const src = photo ? (photo.originalPurged ? (photo.thumbUrl ?? photo.url) : photo.url) : '';
  const go = (d: number) =>
    index !== null && onIndexChange((index + d + photos.length) % photos.length);

  return (
    <Dialog open={photo !== null} onOpenChange={(v) => !v && onIndexChange(null)}>
      <DialogContent size="viewer" className="gap-2">
        {photo && (
          <>
            <DialogTitle className="sr-only">Фото</DialogTitle>
            <img
              src={src}
              alt={caption?.(photo) ?? 'Фото'}
              className="max-h-[80dvh] w-full rounded-md bg-black object-contain"
            />
            <DialogDescription className="text-xs">
              {caption?.(photo) ?? formatDateTime(photo.takenAt ?? photo.createdAt)}
              {photo.originalPurged && ' · оригинал удалён, показано превью'}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={src} download={fileName(photo)}>
                  <Download />
                  Скачать
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={src} target="_blank" rel="noopener">
                  <ExternalLink />
                  Открыть
                </a>
              </Button>
              {photos.length > 1 && (
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => go(-1)}
                    aria-label="Предыдущее"
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {(index ?? 0) + 1} / {photos.length}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => go(1)}
                    aria-label="Следующее"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Миниатюры с просмотром по нажатию. */
export function PhotoThumbs({
  photos,
  size = 'md',
  direction = 'row',
  caption,
}: {
  photos: FileDto[];
  size?: 'sm' | 'md';
  /** column — столбиком (например, справа от текста отметки) */
  direction?: 'row' | 'column';
  caption?: (p: FileDto) => string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className={cn('flex gap-1.5', direction === 'row' ? 'flex-wrap' : 'flex-col')}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              'overflow-hidden rounded-md border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              size === 'sm' ? 'size-14' : 'size-20',
            )}
          >
            <img
              src={p.thumbUrl ?? p.url}
              alt="Фото этапа"
              loading="lazy"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <PhotoViewer photos={photos} index={index} onIndexChange={setIndex} caption={caption} />
    </>
  );
}
