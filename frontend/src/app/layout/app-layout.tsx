import { ROLE_LABELS, type Role } from '@contracts';
import {
  Bell,
  BookOpen,
  Building2,
  FileSpreadsheet,
  FileWarning,
  HardDrive,
  LayoutDashboard,
  type LucideIcon,
  Smartphone,
  Users,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useNotifications } from '@/entities/notification';
import { hasRole, useCurrentUser } from '@/entities/session';
import { ThemeToggle } from '@/features/theme-toggle';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Logo } from '@/shared/ui/logo';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  /** false — не показывать в нижней панели телефона */
  mobile?: boolean;
};

const NAV: NavItem[] = [
  { to: '/', label: 'Сводка', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { to: '/objects', label: 'Объекты', icon: Building2, roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  { to: '/foreman', label: 'Мои объекты', icon: Smartphone, roles: ['FOREMAN'] },
  { to: '/claims', label: 'Рекламации', icon: FileWarning, roles: ['ADMIN', 'MANAGER', 'FINANCE'] },
  {
    to: '/reports',
    label: 'Отчёты',
    icon: FileSpreadsheet,
    roles: ['ADMIN', 'MANAGER', 'FINANCE'],
    mobile: false,
  },
  { to: '/notifications', label: 'Уведомления', icon: Bell, mobile: false },
  { to: '/refs', label: 'Справочники', icon: BookOpen, roles: ['ADMIN', 'MANAGER'] },
  { to: '/users', label: 'Пользователи', icon: Users, roles: ['ADMIN'], mobile: false },
  { to: '/storage', label: 'Хранилище', icon: HardDrive, roles: ['ADMIN'], mobile: false },
];

/** Инициалы для аватара: «Николай Зайцев» → «НЗ». */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Каркас: боковое меню на десктопе, нижняя панель на телефоне. */
export function AppLayout() {
  const user = useCurrentUser();
  const items = NAV.filter((n) => !n.roles || hasRole(user, ...n.roles));
  const mobileItems = items.filter((n) => n.mobile !== false);
  const unread = useNotifications().data?.unread ?? 0;

  // Прокручивается только блок контента: при смене страницы возвращаем его наверх
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: реагируем только на смену пути
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    // Оболочка ровно в высоту экрана: шапка и меню неподвижны, прокручивается только <main>
    <div className="flex h-dvh overflow-hidden bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r bg-background md:flex">
        {/* Логотип ведёт на главную: сводка, у бригадира — его объекты */}
        <Link
          to="/"
          aria-label="На главную"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo className="px-4 py-4" />
        </Link>
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
              {to === '/notifications' && unread > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-white tabular-nums">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-1 border-t px-2 py-2">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn('min-w-0 flex-1 rounded-md px-3 py-2 hover:bg-muted', isActive && 'bg-muted')
            }
          >
            <div className="truncate text-sm font-medium">{user.fullName}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
          </NavLink>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <Link
            to="/"
            aria-label="На главную"
            className="mr-auto rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo subtitle={false} className="[&_svg]:size-7" />
          </Link>
          <Button variant="ghost" size="icon" asChild aria-label="Уведомления">
            <NavLink to="/notifications" className="relative">
              <Bell />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-white">
                  {unread}
                </span>
              )}
            </NavLink>
          </Button>
          <NavLink
            to="/profile"
            aria-label="Профиль"
            className="flex items-center gap-2 rounded-md py-1 pr-1 pl-2 hover:bg-muted"
          >
            <span className="max-w-32 truncate text-xs text-muted-foreground">{user.fullName}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(user.fullName)}
            </span>
          </NavLink>
        </header>
        <main
          ref={mainRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] md:p-6"
        >
          <Outlet />
        </main>

        {mobileItems.length > 1 && (
          <nav
            className="grid shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
            style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
          >
            {mobileItems.map(({ to, label, icon: Icon }) => (
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
    </div>
  );
}
