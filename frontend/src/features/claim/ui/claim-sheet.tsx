import { CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUSES } from '@contracts';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import {
  ClaimStatusBadge,
  claimKeys,
  useClaim,
  useCommentClaim,
  useUpdateClaim,
} from '@/entities/claim';
import { PhotoThumbs, uploadPhoto } from '@/entities/mark';
import { isManager, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';

/** Карточка рекламации: статус, описание, комментарии, фото и документы. */
export function ClaimSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {id && <ClaimBody id={id} />}
      </SheetContent>
    </Sheet>
  );
}

function ClaimBody({ id }: { id: string }) {
  const claim = useClaim(id);
  const user = useCurrentUser();
  const update = useUpdateClaim(id);
  const comment = useCommentClaim(id);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (claim.isPending) return <Skeleton className="m-4 h-64" />;
  if (claim.isError) return <p className="p-4 text-destructive">{errorMessage(claim.error)}</p>;
  const c = claim.data;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadPhoto(c.object.id, f, c.id);
      await qc.invalidateQueries({ queryKey: claimKeys.all });
      toast.success('Фото добавлены');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>Рекламация №{c.number}</SheetTitle>
        <SheetDescription>
          <Link to={`/objects/${c.object.id}`} className="hover:underline">
            {c.object.shortAddress}
          </Link>{' '}
          · {formatDate(c.date)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-4 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {isManager(user) ? (
            <SimpleSelect
              aria-label="Статус"
              className="w-48"
              value={c.status}
              onChange={(v) =>
                v &&
                update.mutate(
                  { status: v as (typeof CLAIM_STATUSES)[number] },
                  { onError: (e) => toast.error(errorMessage(e)) },
                )
              }
              options={CLAIM_STATUSES.map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }))}
            />
          ) : (
            <ClaimStatusBadge status={c.status} />
          )}
          <span className="text-sm text-muted-foreground">{CLAIM_KIND_LABELS[c.kind]}</span>
        </div>

        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Поставщик</dt>
          <dd>{c.supplier}</dd>
          <dt className="text-muted-foreground">Создана</dt>
          <dd>{formatDateTime(c.createdAt)}</dd>
        </dl>
        <p className="text-sm whitespace-pre-wrap">{c.description}</p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Фото и документы</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              Добавить фото
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
          {c.files.length ? (
            <PhotoThumbs photos={c.files} />
          ) : (
            <p className="text-xs text-muted-foreground">Пока ничего не приложено</p>
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <span className="text-sm font-medium">Комментарии</span>
          {c.comments.map((m) => (
            <div key={m.id} className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {m.author.fullName} · {formatDateTime(m.createdAt)}
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          ))}
          <Textarea
            rows={2}
            placeholder="Комментарий"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!text.trim() || comment.isPending}
            onClick={() =>
              comment.mutate(text, {
                onSuccess: () => setText(''),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            Добавить комментарий
          </Button>
        </div>
      </div>
    </>
  );
}
