'use client';

import Link from 'next/link';

import { isNavItemActive, useNavItems } from '@/components/app-shell/nav-items';
import { useNavCounts } from '@/components/app-shell/use-nav-counts';
import { UserMenu } from '@/components/app-shell/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * El riel bajo 900px: una barra inferior fija de iconos con etiqueta corta.
 *
 * No es una degradación del riel, es su forma táctil: mismo azul marino, cada
 * destino con su área de 44×44 y la etiqueta escrita debajo del icono. La barra
 * de llama del activo se muda arriba, que es el borde por el que la barra toca
 * el contenido.
 *
 * Va `fixed` para que quede siempre al alcance del pulgar; el `main` del
 * `AppShell` reserva el hueco de abajo para que no tape la última fila.
 */
export function NavBottomBar() {
  const { items, pathname } = useNavItems();
  const counts = useNavCounts();

  return (
    <div className="bg-rail fixed inset-x-0 bottom-0 z-20 flex items-stretch gap-0.5 border-t border-white/8 px-1.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
      <nav aria-label="Módulos" className="min-w-0 flex-1">
        <ul className="flex items-stretch">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);
            const count = counts[href];

            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-(--touch-min) min-w-(--touch-min) flex-col items-center justify-center gap-1 px-0.5 py-1.5 text-[11px]/4 font-medium transition-colors duration-(--duration-state) ease-standard',
                    active
                      ? 'text-flame-hot before:absolute before:inset-x-[16%] before:top-0 before:h-[3px] before:rounded-b-[3px] before:bg-[linear-gradient(90deg,var(--flame-hot),var(--flame-deep))] before:content-[""]'
                      : 'text-rail-dim',
                  )}
                >
                  <span className="relative">
                    <Icon
                      className="size-icon shrink-0"
                      strokeWidth={ICON_STROKE_WIDTH}
                      aria-hidden
                    />
                    {count === undefined ? null : (
                      <span className="bg-flame absolute -top-1.5 -right-2.5 rounded-full px-1.5 text-[10px] leading-4 font-bold text-white tabular-nums">
                        {count}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="[--logo-sub:var(--rail-faint)] flex shrink-0 items-center gap-0.5 border-l border-white/8 pl-1.5">
        <ThemeToggle className="text-rail-dim hover:bg-white/6 hover:text-rail-text" />
        <UserMenu
          collapsed
          side="top"
          align="end"
          className="text-rail-dim hover:bg-white/6 hover:text-rail-text"
        />
      </div>
    </div>
  );
}
