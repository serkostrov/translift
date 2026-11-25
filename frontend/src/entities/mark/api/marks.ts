import type { FileDto, FileKind, MarkCreate, MarkDto, ObjectDetails } from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';
import { compressPhoto } from '@/shared/lib/image';

export const markKeys = {
  list: (objectId: string) => ['marks', objectId] as const,
  files: (objectId: string, kind?: FileKind) => ['files', objectId, kind ?? 'all'] as const,
};

export function useMarks(objectId: string) {
  return useQuery({
    queryKey: markKeys.list(objectId),
    queryFn: () => http<MarkDto[]>(`/objects/${objectId}/marks`),
  });
}

export function useObjectFiles(objectId: string, kind?: FileKind) {
  return useQuery({
    queryKey: markKeys.files(objectId, kind),
    queryFn: () => http<FileDto[]>(`/objects/${objectId}/files`, { query: { kind } }),
  });
}

/** Сжимает фото на устройстве и загружает оригинал + превью. */
export async function uploadPhoto(objectId: string, file: File): Promise<FileDto> {
  const { full, thumb, takenAt } = await compressPhoto(file);
  const form = new FormData();
  form.set('objectId', objectId);
  form.set('kind', 'PHOTO');
  form.set('takenAt', takenAt);
  form.set('file', full, `${file.name.replace(/\.\w+$/, '')}.jpg`);
  form.set('thumb', thumb, 'thumb.jpg');
  return http<FileDto>('/files', { method: 'POST', body: form });
}

function useInvalidateObject(objectId: string) {
  const qc = useQueryClient();
  return (data: ObjectDetails) => {
    // Ключи объектов — см. entities/object (сущности не импортируют друг друга)
    qc.setQueryData(['objects', 'detail', objectId], data);
    qc.invalidateQueries({ queryKey: ['objects'] });
    qc.invalidateQueries({ queryKey: markKeys.list(objectId) });
    qc.invalidateQueries({ queryKey: ['files', objectId] });
  };
}

export function useCreateMark(objectId: string) {
  const onSuccess = useInvalidateObject(objectId);
  return useMutation({
    mutationFn: (body: MarkCreate) =>
      http<ObjectDetails>(`/objects/${objectId}/marks`, { method: 'POST', body }),
    onSuccess,
  });
}

export function useRevokeLastMark(objectId: string) {
  const onSuccess = useInvalidateObject(objectId);
  return useMutation({
    mutationFn: () => http<ObjectDetails>(`/objects/${objectId}/marks/last`, { method: 'DELETE' }),
    onSuccess,
  });
}
