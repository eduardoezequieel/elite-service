'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Logo } from '@/components/brand/logo';
import { isNavItemActive, useNavSections } from '@/components/app-shell/nav-items';
import { useNavCounts } from '@/components/app-shell/use-nav-counts';
import { UserMenu } from '@/components/app-shell/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/** Alto de la pestaña, elevado al objetivo táctil en densidad `bahía`. */
const TAB_HEIGHT = 'min-h-[max(38px,var(--touch-min))]';

/**
 * El riel del sistema (DESIGN.md → Componentes → Menú lateral).
 *
 * **Azul marino en los dos temas**: es la única superficie que no cambia de
 * color al cambiar de luz, porque es la que dice de quién es el sistema. Arriba
 * la marca, en medio los grupos —Operación, Configuración— y al pie el usuario
 * con el cambio de tema.
 *
 * El ítem activo se marca con tres cosas a la vez: la barra de llama de 3px
 * pegada al borde izquierdo, el fondo tintado y el texto en blanco. Nunca solo
 * con color.
 *
 * Bajo 900px no existe: ahí manda `<NavBottomBar>`.
 */
export function NavRail() {
  const [collapsed, setCollapsed] = useState(false);
  const { sections, pathname } = useNavSections();
  const counts = useNavCounts();

  /**
   * Con un solo grupo visible el rótulo no distingue nada: un cajero ve una
   * pestaña y no necesita que le digan que es «Operación». Se queda para el
   * lector de pantalla, no para el ojo.
   */
  const labelled = sections.length > 1 && !collapsed;

  return (
    <div
      className={cn(
        'bg-rail text-rail-dim [--logo-sub:var(--rail-faint)] hidden shrink-0 flex-col gap-6 border-r border-white/6 px-3.5 py-4 transition-[width] duration-(--duration-state) ease-standard md:sticky md:top-0 md:flex md:h-screen',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      <div
        className={cn('flex items-center gap-2', collapsed ? 'flex-col justify-center' : 'px-1.5')}
      >
        <Logo
          variant={collapsed ? 'mark' : 'full'}
          size={collapsed ? 22 : 26}
          className="text-rail-text min-w-0"
        />

        <Button
          variant="ghost"
          size="icon"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Desplegar el riel' : 'Plegar el riel'}
          onClick={() => setCollapsed((value) => !value)}
          className="text-rail-dim hover:bg-white/6 hover:text-rail-text ml-auto shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          ) : (
            <PanelLeftClose className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          )}
        </Button>
      </div>

      <nav aria-label="Módulos" className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <h2
              className={cn(
                'text-rail-faint mb-1.5 ml-2 text-label font-semibold',
                labelled ? '' : 'sr-only',
              )}
            >
              {section.label}
            </h2>

            <ul className="flex flex-col gap-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = isNavItemActive(pathname, href);
                const count = counts[href];

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? label : undefined}
                      className={cn(
                        'relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-body font-medium transition-colors duration-(--duration-state) ease-standard',
                        TAB_HEIGHT,
                        collapsed && 'justify-center px-0',
                        active
                          ? [
                              'bg-[color-mix(in_srgb,var(--flame)_14%,transparent)] text-white',
                              'before:absolute before:-left-3.5 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-[3px] before:bg-[linear-gradient(180deg,var(--flame-hot),var(--flame-deep))] before:content-[""]',
                            ]
                          : 'text-rail-dim hover:bg-white/5 hover:text-rail-text',
                      )}
                    >
                      <Icon
                        className={cn('size-icon shrink-0', active ? 'text-flame' : 'opacity-80')}
                        strokeWidth={ICON_STROKE_WIDTH}
                        aria-hidden
                      />
                      <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>

                      {count === undefined || collapsed ? null : (
                        <span
                          className={cn(
                            'ml-auto rounded-full px-[7px] py-px text-label font-bold tabular-nums',
                            active ? 'bg-flame text-white' : 'text-rail-text bg-white/9',
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'mt-auto flex items-center gap-2 border-t border-white/7 pt-2.5',
          collapsed && 'flex-col',
        )}
      >
        {/* El riel es azul marino en los dos temas, así que su pie no puede usar
            los colores de texto del tema: se le pasan los del riel. */}
        <UserMenu
          collapsed={collapsed}
          className={cn(
            'text-rail-dim hover:bg-white/6 hover:text-rail-text',
            collapsed ? undefined : 'min-w-0 flex-1',
          )}
        />
        <ThemeToggle className="text-rail-dim hover:bg-white/6 hover:text-rail-text" />
      </div>
    </div>
  );
}
