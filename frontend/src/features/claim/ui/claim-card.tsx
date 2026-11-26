import {
  CLAIM_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUSES,
  DOCUMENT_ACCEPT,
} from '@contracts';
import { useQueryClient } from '@tanstack/react-query';
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
import { DocumentList, PhotoThumbs, uploadDocument, uploadPhoto } from '@/entities/mark';
import { isManager, useCurrentUser } from '@/entities/session';
import { errorMessage } from '@/shared/api/http';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { FilePlus, ImagePlus, Loader2 } from '@/shared/ui/icons';
import { SimpleSelect } from '@/shared/ui/simple-select';
import { BlockSkeleton } from '@/shared/ui/skeletons';
import { Textarea } from '@/shared/ui/textarea';

/** Рекламация на своей странице: статус, описание, фото и документы, обсуждение. */
export function ClaimCard({ id }: { id: string }) {
  const claim = useClaim(id);
  const user = useCurrentUser();
  const update = useUpdateClaim(id);
  const comment = useCommentClaim(id);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  if (claim.isPending) return <BlockSkeleton lines={8} />;
  if (claim.isError) return <p className="text-destructive">{errorMessage(claim.error)}</p>;
  const c = claim.data;

  const add = async (files: FileList | null, kind: 'photo' | 'document') => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (kind === 'photo') await uploadPhoto(c.object.id, f, c.id);
        else await uploadDocument(c.object.id, f, c.id);
      }
      toast.success(kind === 'photo' ? 'Фото добавлены' : 'Документы добавлены');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      await qc.invalidateQueries({ queryKey: claimKeys.all });
      setUploading(false);
    }
  };
  const photos = c.files.filter((f) => f.kind === 'PHOTO');
  const documents = c.files.filter((f) => f.kind === 'DOCUMENT');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Рекламация №{c.number}</h1>
        <p className="text-sm text-muted-foreground">
          <Link
            to={`/objects/${c.object.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {c.object.shortAddress}
          </Link>{' '}
          · {formatDate(c.date)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardContent className="space-y-4">
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Фото и документы</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                    Фото
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => docRef.current?.click()}
                    disabled={uploading}
                  >
                    <FilePlus />
                    Документ
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void add(e.target.files, 'photo');
                    e.target.value = '';
                  }}
                />
                <input
                  ref={docRef}
                  type="file"
                  accept={DOCUMENT_ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    void add(e.target.files, 'document');
                    e.target.value = '';
                  }}
                />
              </div>
              {!c.files.length && (
                <p className="text-xs text-muted-foreground">Пока ничего не приложено</p>
              )}
              {photos.length > 0 && <PhotoThumbs photos={photos} />}
              {documents.length > 0 && <DocumentList files={documents} />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Обсуждение</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!c.comments.length && (
              <p className="text-sm text-muted-foreground">Комментариев пока нет</p>
            )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
