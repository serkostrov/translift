import { Building2, HardDrive, LayoutDashboard, Smartphone } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/shared/lib/utils';

const NAV = [
  { to: '/', label: 'Сводка', icon: LayoutDashboard },
  { to: '/objects', label: 'Объекты', icon: Building2 },
  { to: '/foreman', label: 'Бригадир', icon: Smartphone },
  { to: '/storage', label: 'Хранилище', icon: HardDrive },
] as const;

/** Каркас: боковое меню на десктопе, нижняя панель на телефоне. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
        <div className="px-5 py-4">
          <div className="font-semibold">Транслифт</div>
          <div className="text-xs text-muted-foreground">Контроль монтажа лифтов</div>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
                  isActive && 'bg-muted font-medium',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 p-4 pb-20 md:p-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t bg-background md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground',
                isActive && 'text-foreground',
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
