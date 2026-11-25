import type { FileDto } from '@contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';

type ViewerProps = {
  photos: FileDto[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  caption?: (p: FileDto) => string;
};

/** Просмотр фото во весь экран с листанием. */
export function PhotoViewer({ photos, index, onIndexChange, caption }: ViewerProps) {
  const photo = index === null ? null : photos[index];
  const go = (d: number) =>
    index !== null && onIndexChange((index + d + photos.length) % photos.length);

  return (
    <Dialog open={photo !== null} onOpenChange={(v) => !v && onIndexChange(null)}>
      <DialogContent className="max-w-[min(96vw,1100px)] gap-2 p-2 sm:p-3">
        {photo && (
          <>
            <DialogTitle className="sr-only">Фото</DialogTitle>
            <img
              src={photo.originalPurged ? (photo.thumbUrl ?? photo.url) : photo.url}
              alt={caption?.(photo) ?? 'Фото'}
              className="max-h-[80dvh] w-full rounded-md bg-black object-contain"
            />
            <div className="flex items-center gap-2">
              <DialogDescription className="flex-1 text-xs">
                {caption?.(photo) ?? formatDateTime(photo.takenAt ?? photo.createdAt)}
                {photo.originalPurged && ' · оригинал удалён, показано превью'}
              </DialogDescription>
              {photos.length > 1 && (
                <>
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
                </>
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
  caption,
}: {
  photos: FileDto[];
  size?: 'sm' | 'md';
  caption?: (p: FileDto) => string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
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
