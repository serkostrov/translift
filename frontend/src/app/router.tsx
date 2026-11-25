import { createBrowserRouter } from 'react-router';
import { DashboardPage } from '@/pages/dashboard';
import { ForemanPage } from '@/pages/foreman';
import { NotFoundPage } from '@/pages/not-found';
import { ObjectsPage } from '@/pages/objects';
import { StoragePage } from '@/pages/storage';
import { AppLayout } from './layout/app-layout';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'objects', element: <ObjectsPage /> },
      { path: 'foreman', element: <ForemanPage /> },
      { path: 'storage', element: <StoragePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
