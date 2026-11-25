import { ROLE_LABELS, type Role } from '@contracts';
import {
  BookOpen,
  Building2,
  HardDrive,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Smartphone,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { hasRole, useCurrentUser, useLogout } from '@/entities/session';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: Role[] };

const NAV: NavItem[] = [
  { to: '/', label: 'Сводка', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { to: '/objects', label: 'Объекты', icon: Building2, roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { to: '/foreman', label: 'Мои объекты', icon: Smartphone, roles: ['FOREMAN'] },
  { to: '/refs', label: 'Справочники', icon: BookOpen, roles: ['ADMIN', 'MANAGER'] },
  { to: '/storage', label: 'Хранилище', icon: HardDrive, roles: ['ADMIN'] },
];

/** Каркас: боковое меню на десктопе, нижняя панель на телефоне. */
export function AppLayout() {
  const user = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.roles || hasRole(user, ...n.roles));

  const onLogout = () => logout.mutate(undefined, { onSettled: () => navigate('/login') });

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="px-5 py-4">
          <div className="font-semibold">Транслифт</div>
          <div className="text-xs text-muted-foreground">Контроль монтажа лифтов</div>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {items.map(({ to, label, icon: Icon }) => (
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
        <div className="mt-auto border-t px-4 py-3 text-sm">
          <div className="font-medium">{user.fullName}</div>
          <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onLogout}>
            <LogOut />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background px-4 py-2 md:hidden">
          <span className="font-semibold">Транслифт</span>
          <Button variant="ghost" size="sm" onClick={onLogout} aria-label="Выйти">
            <span className="max-w-40 truncate text-xs text-muted-foreground">{user.fullName}</span>
            <LogOut />
          </Button>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6">
          <Outlet />
        </main>
      </div>

      {items.length > 1 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map(({ to, label, icon: Icon }) => (
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
      )}
    </div>
  );
}
