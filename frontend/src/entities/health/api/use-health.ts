import { useQuery } from '@tanstack/react-query';
import { http } from '@/shared/api/http';

export type Health = { status: 'ok'; db: boolean; storage: boolean };

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => http<Health>('/health'),
    refetchInterval: 30_000,
  });
}
