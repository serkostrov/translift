import type {
  AuditEntry,
  ObjectCreate,
  ObjectDetails,
  ObjectListItem,
  ObjectListQuery,
  ObjectUpdate,
} from '@contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export const objectKeys = {
  all: ['objects'] as const,
  list: (q: ObjectListQuery) => ['objects', 'list', q] as const,
  detail: (id: string) => ['objects', 'detail', id] as const,
  history: (id: string) => ['objects', 'history', id] as const,
};

export function useObjects(query: ObjectListQuery = {}) {
  return useQuery({
    queryKey: objectKeys.list(query),
    queryFn: () => http<ObjectListItem[]>('/objects', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useObject(id: string) {
  return useQuery({
    queryKey: objectKeys.detail(id),
    queryFn: () => http<ObjectDetails>(`/objects/${id}`),
  });
}

export function useObjectHistory(id: string) {
  return useQuery({
    queryKey: objectKeys.history(id),
    queryFn: () => http<AuditEntry[]>(`/objects/${id}/history`),
  });
}

export function useCreateObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ObjectCreate) => http<ObjectDetails>('/objects', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: objectKeys.all }),
  });
}

export function useUpdateObject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ObjectUpdate) =>
      http<ObjectDetails>(`/objects/${id}`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      qc.setQueryData(objectKeys.detail(id), data);
      qc.invalidateQueries({ queryKey: objectKeys.all });
      qc.invalidateQueries({ queryKey: ['brigades'] });
    },
  });
}
