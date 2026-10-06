'use client';

import { Ellipsis } from 'lucide-react';
import Link from 'next/link';

import {
  bottomBarShowsAll,
  isNavItemActive,
  useNavItems,
  useWorkspaces,
  type NavItem,
} from '@/components/app-shell/nav-items';
import { useNavCounts } from '@/components/app-shell/use-nav-counts';
import { UserMenu } from '@/components/app-shell/user-menu';
import { WorkspaceMenuItems } from '@/components/app-shell/workspace-switcher';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { DensityMenuItems } from '@/components/density-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ICON_STROKE_WIDTH = 1.5;
const PINNED = 4;

/**
 * Barra táctil. Cuatro destinos + Más (tema, usuario y densidad viven ahí).
 * En la renta (107) se muestran las cinco, con icono y rótulo, y no hay
 * «Más»: la cuenta pasa a la franja de arriba. Los otros espacios no cambian.
 *
 * Los destinos son los del espacio de trabajo activo; los espacios, si hay más
 * de uno, van como grupo dentro de Más, antes de densidad y tema (094).
 */
export function NavBottomBar() {
  const { items, pathname } = useNavItems();
  const { active, workspaces } = useWorkspaces();
  const counts = useNavCounts();
  const showAll = bottomBarShowsAll(active?.key, items.length);
  const pinned = showAll ? items : items.slice(0, PINNED);
  const overflow = showAll ? [] : items.slice(PINNED);

  return (
    <div
      data-slot="nav-bottom-bar"
      className="bg-rail fixed inset-x-0 bottom-0 z-20 flex items-stretch gap-0.5 border-t border-white/8 px-1.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <nav aria-label="Módulos" className="min-w-0 flex-1">
        <ul className="flex items-stretch">
          {pinned.map((item) => (
            <li key={item.href} className="min-w-0 flex-1">
              <NavIconLink item={item} pathname={pathname} count={counts[item.href]} />
            </li>
          ))}
          {showAll ? null : (
            <li className="min-w-0 flex-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-rail-dim relative flex min-h-(--touch-min) min-w-(--touch-min) w-full flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-(length:--nav-label-size)/4 font-medium"
                  >
                    <Ellipsis
                      className="size-icon shrink-0"
                      strokeWidth={ICON_STROKE_WIDTH}
                      aria-hidden
                    />
                    <span>Más</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="min-w-56">
                  {overflow.map((item) => {
                    const Icon = item.icon;

                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>
                          <Icon className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  {overflow.length > 0 ? <DropdownMenuSeparator /> : null}
                  {workspaces.length > 1 ? (
                    <>
                      <WorkspaceMenuItems withLabel />
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DensityMenuItems />
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between gap-2 px-1 py-1">
                    <ThemeToggle />
                    <RequirePermission permission="notifications.read">
                      <NotificationBell collapsed />
                    </RequirePermission>
                    <UserMenu collapsed side="top" align="end" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}

function NavIconLink({
  item,
  pathname,
  count,
}: {
  item: NavItem;
  pathname: string;
  count: number | undefined;
}) {
  const { href, label, icon: Icon } = item;
  const active = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-(--touch-min) min-w-(--touch-min) flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-(length:--nav-label-size)/4 font-medium transition-colors duration-(--duration-state) ease-standard',
        active
          ? 'text-flame-hot before:absolute before:inset-x-[16%] before:top-0 before:h-(--active-mark) before:rounded-b-(--active-mark) before:[background-image:var(--gradient-bar-active)] before:content-[""]'
          : 'text-rail-dim',
      )}
    >
      <span className="relative">
        <Icon className="size-icon shrink-0" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        {count === undefined ? null : (
          <span className="bg-flame absolute -top-1.5 -right-2.5 rounded-full px-1.5 text-(length:--nav-badge-size) leading-4 font-bold text-white tabular-nums">
            {count}
          </span>
        )}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
