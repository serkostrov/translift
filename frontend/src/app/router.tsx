import type { Role } from '@contracts';
import { type ComponentType, lazy, type ReactNode, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { hasRole, useCurrentUser } from '@/entities/session';
import { ErrorPage } from '@/pages/error';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { ElevatorLoader } from '@/shared/ui/elevator-loader';
import { AppLayout } from './layout/app-layout';
import { RequireAuth } from './layout/require-auth';

/**
 * Страницы грузятся по требованию: бригадиру с телефона не нужно скачивать
 * сводку, справочники и отчёты. Пока кусок грузится — едущий лифт.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy<ComponentType>(() => load().then((m) => ({ default: m[name] })));
}

const DashboardPage = page(() => import('@/pages/dashboard'), 'DashboardPage');
const ObjectsPage = page(() => import('@/pages/objects'), 'ObjectsPage');
const ObjectPage = page(() => import('@/pages/object'), 'ObjectPage');
const ForemanPage = page(() => import('@/pages/foreman'), 'ForemanPage');
const ClaimsPage = page(() => import('@/pages/claims'), 'ClaimsPage');
const ClaimPage = page(() => import('@/pages/claim'), 'ClaimPage');
const ReportsPage = page(() => import('@/pages/reports'), 'ReportsPage');
const NotificationsPage = page(() => import('@/pages/notifications'), 'NotificationsPage');
const ProfilePage = page(() => import('@/pages/profile'), 'ProfilePage');
const RefsPage = page(() => import('@/pages/refs'), 'RefsPage');
const UsersPage = page(() => import('@/pages/users'), 'UsersPage');
const StoragePage = page(() => import('@/pages/storage'), 'StoragePage');
const ContractPage = page(() => import('@/pages/directory'), 'ContractPage');
const CustomerPage = page(() => import('@/pages/directory'), 'CustomerPage');

function Lazy({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const content = <Suspense fallback={<ElevatorLoader />}>{children}</Suspense>;
  return roles ? <RequireAuth roles={roles}>{content}</RequireAuth> : content;
}

/** Бригадира с главной — сразу в его объекты. */
function Home() {
  const user = useCurrentUser();
  return hasRole(user, 'FOREMAN') ? (
    <Navigate to="/foreman" replace />
  ) : (
    <Lazy>
      <DashboardPage />
    </Lazy>
  );
}

const OFFICE: Role[] = ['ADMIN', 'MANAGER', 'FINANCE'];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        // Ошибка внутри страницы не роняет меню: показываем её в области контента
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Home /> },
          {
            path: 'objects',
            element: (
              <Lazy roles={OFFICE}>
                <ObjectsPage />
              </Lazy>
            ),
          },
          {
            path: 'objects/:id',
            element: (
              <Lazy>
                <ObjectPage />
              </Lazy>
            ),
          },
          {
            path: 'foreman',
            element: (
              <Lazy>
                <ForemanPage />
              </Lazy>
            ),
          },
          {
            path: 'notifications',
            element: (
              <Lazy>
                <NotificationsPage />
              </Lazy>
            ),
          },
          {
            path: 'profile',
            element: (
              <Lazy>
                <ProfilePage />
              </Lazy>
            ),
          },
          {
            path: 'claims',
            element: (
              <Lazy roles={OFFICE}>
                <ClaimsPage />
              </Lazy>
            ),
          },
          {
            // Бригадир открывает рекламации своего объекта; доступ проверяет сервер
            path: 'claims/:id',
            element: (
              <Lazy>
                <ClaimPage />
              </Lazy>
            ),
          },
          {
            path: 'reports',
            element: (
              <Lazy roles={OFFICE}>
                <ReportsPage />
              </Lazy>
            ),
          },
          {
            path: 'refs',
            element: (
              <Lazy roles={['ADMIN', 'MANAGER']}>
                <RefsPage />
              </Lazy>
            ),
          },
          {
            path: 'contracts/:id',
            element: (
              <Lazy roles={OFFICE}>
                <ContractPage />
              </Lazy>
            ),
          },
          {
            path: 'customers/:id',
            element: (
              <Lazy roles={OFFICE}>
                <CustomerPage />
              </Lazy>
            ),
          },
          {
            path: 'users',
            element: (
              <Lazy roles={['ADMIN']}>
                <UsersPage />
              </Lazy>
            ),
          },
          {
            path: 'storage',
            element: (
              <Lazy roles={['ADMIN']}>
                <StoragePage />
              </Lazy>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
