import type {
  ClaimCreate,
  ClaimDetails,
  ClaimDto,
  ClaimListQuery,
  ClaimUpdate,
  FinanceDto,
  FinanceUpdate,
  Page,
} from '@contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/shared/api/http';
import { useInfinitePages } from '@/shared/api/infinite';

export const claimKeys = {
  all: ['claims'] as const,
  list: (q: ClaimListQuery) => ['claims', 'list', q] as const,
  detail: (id: string) => ['claims', 'detail', id] as const,
  page: (q: ClaimListQuery) => ['claims', 'page', q] as const,
};

/** Рекламации порциями — для раздела «Рекламации». */
export function useClaimPages(query: ClaimListQuery = {}) {
  return useInfinitePages<ClaimDto>(claimKeys.page(query), (offset) =>
    http<Page<ClaimDto>>('/claims/page', { query: { ...query, offset } }),
  );
}

export function useClaims(query: ClaimListQuery = {}) {
  return useQuery({
    queryKey: claimKeys.list(query),
    queryFn: () => http<ClaimDto[]>('/claims', { query }),
    placeholderData: keepPreviousData,
  });
}

export function useClaim(id: string | null) {
  return useQuery({
    queryKey: claimKeys.detail(id ?? ''),
    queryFn: () => http<ClaimDetails>(`/claims/${id}`),
    enabled: !!id,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['claims', 'suppliers'],
    queryFn: () => http<string[]>('/claims/suppliers'),
    staleTime: 5 * 60_000,
  });
}

function useClaimMutation<T>(fn: (body: T) => Promise<ClaimDetails>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(claimKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: claimKeys.all });
      qc.invalidateQueries({ queryKey: ['objects', 'history', data.object.id] });
    },
  });
}

export const useCreateClaim = () =>
  useClaimMutation((body: ClaimCreate) => http<ClaimDetails>('/claims', { method: 'POST', body }));

export const useUpdateClaim = (id: string) =>
  useClaimMutation((body: ClaimUpdate) =>
    http<ClaimDetails>(`/claims/${id}`, { method: 'PATCH', body }),
  );

export const useCommentClaim = (id: string) =>
  useClaimMutation((text: string) =>
    http<ClaimDetails>(`/claims/${id}/comments`, { method: 'POST', body: { text } }),
  );

// ---------- Финансы объекта ----------

export function useFinance(objectId: string) {
  return useQuery({
    queryKey: ['finance', objectId],
    queryFn: () => http<FinanceDto>(`/objects/${objectId}/finance`),
  });
}

export function useSaveFinance(objectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FinanceUpdate) =>
      http<FinanceDto>(`/objects/${objectId}/finance`, { method: 'PUT', body }),
    onSuccess: (data) => {
      qc.setQueryData(['finance', objectId], data);
      qc.invalidateQueries({ queryKey: ['objects', 'history', objectId] });
    },
  });
}
