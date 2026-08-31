'use client';

import Link from 'next/link';

import { isNavItemActive, useNavItems } from '@/components/app-shell/nav-items';
import { UserMenu } from '@/components/app-shell/user-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * El riel bajo 768px: una barra inferior de iconos con etiqueta
 * (DESIGN.md → Layout y Components → Navigation).
 *
 * No es una degradación del riel, es su forma táctil: cada destino tiene su
 * área de 44×44 como mínimo y la etiqueta escrita debajo del icono. La muesca de
 * 3px en Naranja Elite se pega al borde superior, que es el borde por el que la
 * barra toca el contenido.
 *
 * Va pegada al final del flujo con `sticky`, no `fixed`: así nunca tapa la
 * última fila de una tabla.
 */
export function NavBottomBar() {
  const { items, pathname } = useNavItems();

  return (
    <div className="bg-card border-rule sticky bottom-0 z-10 flex items-stretch gap-1 border-t px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
      <nav aria-label="Módulos" className="min-w-0 flex-1">
        <ul className="flex items-stretch">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);

            return (
              <li key={href} className="min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-[var(--touch-min)] min-w-[var(--touch-min)] flex-col items-center justify-center gap-0.5 px-2 py-2 text-label transition-colors duration-(--duration-state) ease-standard',
                    active
                      ? 'text-foreground font-semibold before:bg-brand before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:content-[""]'
                      : 'text-muted-foreground font-medium',
                  )}
                >
                  <Icon
                    className="size-icon shrink-0"
                    strokeWidth={ICON_STROKE_WIDTH}
                    aria-hidden
                  />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator orientation="vertical" className="my-2 h-auto" />

      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <UserMenu collapsed side="top" align="end" />
      </div>
    </div>
  );
}
