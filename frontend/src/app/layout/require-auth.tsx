import type { Role } from '@contracts';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { hasRole, useSession } from '@/entities/session';
import { SetPasswordScreen } from '@/features/set-password';
import { ElevatorLoader } from '@/shared/ui/elevator-loader';

/** Пускает только вошедших; с `roles` — только эти роли (остальных — на главную). */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ElevatorLoader />
      </div>
    );
  }
  if (session.isError) {
    return <p className="p-6 text-destructive">Сервер недоступен. Обновите страницу позже.</p>;
  }
  if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Временный пароль от администратора: сначала свой пароль, потом всё остальное
  if (session.data.mustChangePassword) return <SetPasswordScreen user={session.data} />;
  if (roles && !hasRole(session.data, ...roles)) return <Navigate to="/" replace />;
  return children;
}
