import { createBrowserRouter, Navigate } from 'react-router';
import { hasRole, useCurrentUser } from '@/entities/session';
import { ClaimsPage } from '@/pages/claims';
import { DashboardPage } from '@/pages/dashboard';
import { ForemanPage } from '@/pages/foreman';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { NotificationsPage } from '@/pages/notifications';
import { ObjectPage } from '@/pages/object';
import { ObjectsPage } from '@/pages/objects';
import { RefsPage } from '@/pages/refs';
import { StoragePage } from '@/pages/storage';
import { AppLayout } from './layout/app-layout';
import { RequireAuth } from './layout/require-auth';

/** Бригадира с главной — сразу в его объекты. */
function Home() {
  const user = useCurrentUser();
  return hasRole(user, 'FOREMAN') ? <Navigate to="/foreman" replace /> : <DashboardPage />;
}

const OFFICE = ['ADMIN', 'MANAGER', 'FINANCE'] as const;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: 'objects',
        element: (
          <RequireAuth roles={[...OFFICE]}>
            <ObjectsPage />
          </RequireAuth>
        ),
      },
      { path: 'objects/:id', element: <ObjectPage /> },
      { path: 'foreman', element: <ForemanPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      {
        path: 'claims',
        element: (
          <RequireAuth roles={[...OFFICE]}>
            <ClaimsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'refs',
        element: (
          <RequireAuth roles={['ADMIN', 'MANAGER']}>
            <RefsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'storage',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <StoragePage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
