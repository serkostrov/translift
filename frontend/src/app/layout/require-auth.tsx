import type { Role } from '@contracts';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { hasRole, useSession } from '@/entities/session';
import { Skeleton } from '@/shared/ui/skeleton';

/** Пускает только вошедших; с `roles` — только эти роли (остальных — на главную). */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (session.isError) {
    return <p className="p-6 text-destructive">Сервер недоступен. Обновите страницу позже.</p>;
  }
  if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !hasRole(session.data, ...roles)) return <Navigate to="/" replace />;
  return children;
}
