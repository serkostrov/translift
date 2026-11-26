import {
  type FileDto,
  MARK_BACKDATE_DAYS,
  MAX_PHOTOS_PER_MARK,
  type ObjectDetails,
  type TemplateStageDto,
} from '@contracts';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { deleteDraftPhoto, uploadPhoto, useCreateMark } from '@/entities/mark';
import { useTemplates } from '@/entities/refs';
import { errorMessage } from '@/shared/api/http';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Camera, ImagePlus, Loader2, RotateCw, X } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Textarea } from '@/shared/ui/textarea';

type PhotoItem = {
  key: string;
  file: File;
  preview: string;
  status: 'uploading' | 'done' | 'error';
  uploaded?: FileDto;
};

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Отметка этапа: этап, фото с камеры, комментарий, дата. На телефоне — шторка снизу. */
export function MarkStageDialog({
  object,
  trigger,
}: {
  object: ObjectDetails;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {open && <MarkForm object={object} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MarkForm({ object, onDone }: { object: ObjectDetails; onDone: () => void }) {
  const templates = useTemplates();
  const create = useCreateMark(object.id);
  const stages: TemplateStageDto[] =
    templates.data?.find((t) => t.id === object.templateId)?.stages ?? [];
  const available = stages.filter((s) => s.order > (object.currentStage?.order ?? 0));

  const [stageId, setStageId] = useState<string | null>(object.nextStage?.id ?? null);
  const [comment, setComment] = useState('');
  const today = localDate(new Date());
  const minDate = localDate(new Date(Date.now() - MARK_BACKDATE_DAYS * 86_400_000));
  const [date, setDate] = useState(today);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Закрыли без сохранения — загруженные фото остались бы на сервере «без этапа»:
  // удаляем их сразу (а те, что ещё грузятся, — как только догрузятся). Превью освобождаем.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const closedRef = useRef(false);
  const savedRef = useRef(false);
  useEffect(
    () => () => {
      closedRef.current = true;
      for (const p of photosRef.current) {
        URL.revokeObjectURL(p.preview);
        if (!savedRef.current && p.uploaded) void deleteDraftPhoto(p.uploaded.id);
      }
    },
    [],
  );

  const stage = available.find((s) => s.id === stageId);
  const skipped = stage ? stage.order - (object.currentStage?.order ?? 0) - 1 : 0;
  const ready = photos.filter((p) => p.status === 'done');
  const uploading = photos.some((p) => p.status === 'uploading');
  const needPhoto = !!stage?.photoRequired && ready.length === 0;

  const start = (item: PhotoItem) => {
    setPhotos((list) => list.map((p) => (p.key === item.key ? { ...p, status: 'uploading' } : p)));
    uploadPhoto(object.id, item.file).then(
      (uploaded) => {
        // Форму уже закрыли, пока фото грузилось
        if (closedRef.current && !savedRef.current) {
          void deleteDraftPhoto(uploaded.id);
          return;
        }
        setPhotos((list) =>
          list.map((p) => (p.key === item.key ? { ...p, status: 'done', uploaded } : p)),
        );
      },
      (e) => {
        toast.error(`Фото не загрузилось: ${errorMessage(e)}`);
        setPhotos((list) => list.map((p) => (p.key === item.key ? { ...p, status: 'error' } : p)));
      },
    );
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS_PER_MARK - photos.length;
    const items = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, room)
      .map<PhotoItem>((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: 'uploading',
      }));
    if (files.length > room) toast.warning(`Не больше ${MAX_PHOTOS_PER_MARK} фото на отметку`);
    setPhotos((list) => [...list, ...items]);
    items.forEach(start);
  };

  const remove = (key: string) =>
    setPhotos((list) => {
      const p = list.find((x) => x.key === key);
      if (p) URL.revokeObjectURL(p.preview);
      if (p?.uploaded) void deleteDraftPhoto(p.uploaded.id);
      return list.filter((x) => x.key !== key);
    });

  const submit = () => {
    if (!stage) return;
    create.mutate(
      {
        stageId: stage.id,
        date: date === today ? undefined : date,
        comment,
        photoIds: ready.map((p) => p.uploaded?.id as string),
      },
      {
        onSuccess: (obj) => {
          savedRef.current = true;
          toast.success(`Этап отмечен. Выполнено ${obj.percent}%`);
          onDone();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Отметить этап</DialogTitle>
        <DialogDescription>{object.shortAddress}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="stage">Этап</FieldLabel>
          <SimpleSelect
            id="stage"
            value={stageId}
            onChange={setStageId}
            placeholder="Выберите этап"
            options={available.map((s) => ({
              value: s.id,
              label: `${s.shortName} — ${s.percent}%`,
            }))}
          />
          {skipped > 0 && (
            <FieldDescription>
              Пропущенные этапы ({skipped}) отметятся вместе с этим
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel>
            Фото{' '}
            {stage?.photoRequired && <span className="text-muted-foreground">(обязательно)</span>}
          </FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <div
                key={p.key}
                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <img src={p.preview} alt="" className="size-full object-cover" />
                {p.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </div>
                )}
                {p.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => start(p)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/60 text-[10px] text-white"
                  >
                    <RotateCw className="size-4" />
                    Повторить
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  aria-label="Убрать фото"
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS_PER_MARK && (
              <>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground active:bg-muted"
                >
                  <Camera className="size-6" />
                  Камера
                </button>
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-[11px] text-muted-foreground active:bg-muted"
                >
                  <ImagePlus className="size-6" />
                  Галерея
                </button>
              </>
            )}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="comment">Комментарий</FieldLabel>
          <Textarea
            id="comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Например: двери 1–9 эт. установлены"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="date">Дата выполнения</FieldLabel>
          <Input
            id="date"
            type="date"
            value={date}
            min={minDate}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
          />
        </Field>
      </div>

      <DialogFooter className="sm:flex-col sm:items-stretch">
        <Button
          size="lg"
          className={cn('h-12 text-base')}
          disabled={!stage || needPhoto || uploading || create.isPending}
          onClick={submit}
        >
          {create.isPending ? 'Отмечаем…' : uploading ? 'Загружаем фото…' : 'Отметить этап'}
        </Button>
        {needPhoto && !uploading && (
          <p className="text-center text-xs text-muted-foreground">Добавьте хотя бы одно фото</p>
        )}
        <DialogClose asChild>
          <Button variant="ghost">Отмена</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
