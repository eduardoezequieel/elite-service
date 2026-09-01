'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LogoPlaceholder } from '@/components/brand/logo-placeholder';
import { isNavItemActive, useNavItems } from '@/components/app-shell/nav-items';
import { UserMenu } from '@/components/app-shell/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * Alto de pestaña: 34px de DESIGN.md, elevado al objetivo táctil cuando la
 * densidad es `bahía` (44px). Una pestaña es algo que se toca.
 */
const TAB_HEIGHT = 'h-[max(34px,var(--touch-min))]';

/**
 * El riel tabulado (DESIGN.md → Components → Navigation).
 *
 * 200px desplegado, 52px plegado. Cada módulo es una pestaña: en reposo, texto
 * Grafito sin fondo; en hover, texto Tinta sobre Papel; activa, muesca de 3px en
 * Naranja Elite pegada al borde izquierdo — nunca un bloque de fondo relleno.
 *
 * El riel se apoya en Lámina para que el hover en Papel se vea: son dos
 * superficies distintas, como la hoja sobre la mesa.
 *
 * Bajo 768px no existe: ahí manda `<NavBottomBar>`.
 */
export function NavRail() {
  const [collapsed, setCollapsed] = useState(false);
  const { items, pathname } = useNavItems();

  return (
    <div
      className={cn(
        'bg-card border-rule hidden shrink-0 flex-col border-r transition-[width] duration-(--duration-state) ease-standard md:sticky md:top-0 md:flex md:h-screen',
        collapsed ? 'w-[52px]' : 'w-[200px]',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 py-3',
          collapsed ? 'flex-col justify-center px-0.5' : 'px-2',
        )}
      >
        <LogoPlaceholder
          className={cn('px-2', collapsed ? 'w-full' : 'min-w-0 flex-1')}
          label={<span className="truncate">{collapsed ? 'ES' : 'Elite Service'}</span>}
        />

        <Button
          variant="ghost"
          size="icon"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Desplegar el riel' : 'Plegar el riel'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          ) : (
            <PanelLeftClose className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          )}
        </Button>
      </div>

      <nav aria-label="Módulos" className="border-border flex-1 overflow-y-auto border-t">
        <ul className="divide-border flex flex-col divide-y">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'relative flex items-center gap-2 px-3 text-label transition-colors duration-(--duration-state) ease-standard',
                    TAB_HEIGHT,
                    collapsed && 'justify-center px-0',
                    active
                      ? 'text-foreground font-semibold before:bg-brand before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]'
                      : 'text-muted-foreground hover:bg-background hover:text-foreground font-medium',
                  )}
                >
                  <Icon
                    className="size-icon shrink-0"
                    strokeWidth={ICON_STROKE_WIDTH}
                    aria-hidden
                  />
                  <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          'border-border flex items-center gap-1 border-t',
          collapsed ? 'flex-col px-0.5 py-2' : 'p-2',
        )}
      >
        <UserMenu collapsed={collapsed} className={collapsed ? undefined : 'min-w-0 flex-1'} />
        <ThemeToggle />
      </div>
    </div>
  );
}
