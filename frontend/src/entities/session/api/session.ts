import type { LoginInput, Role, SessionUser } from '@contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, http } from '@/shared/api/http';

export const sessionKey = ['session'] as const;

/** Текущий пользователь; null — не вошёл. */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await http<SessionUser>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Пользователь внутри защищённой части приложения — там он всегда есть. */
export function useCurrentUser(): SessionUser {
  const { data } = useSession();
  if (!data) throw new Error('useCurrentUser вне RequireAuth');
  return data;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginInput) => http<SessionUser>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(sessionKey, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => http<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  });
}

export const hasRole = (user: SessionUser | null | undefined, ...roles: Role[]) =>
  !!user && roles.includes(user.role);

/** Может создавать и править объекты и справочники. */
export const isManager = (user: SessionUser | null | undefined) =>
  hasRole(user, 'ADMIN', 'MANAGER');
