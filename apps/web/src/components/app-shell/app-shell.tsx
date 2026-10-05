'use client';

import type { ReactNode } from 'react';

import { CompactAccountBar } from '@/components/app-shell/compact-account-bar';
import { NavBottomBar } from '@/components/app-shell/nav-bottom-bar';
import { NavRail } from '@/components/app-shell/nav-rail';

/**
 * El armazón del área autenticada (DESIGN.md → Layout).
 *
 * Riel a la izquierda + área de contenido. No hay barra superior global: el riel
 * ya dice el módulo, y el enlace de regreso de las pantallas hijas lo dibuja el
 * `ScreenHeader` de cada pantalla, pegado sobre su título. Bajo 900px el riel se muda al pie como barra
 * de iconos fija y el contenido ocupa todo el ancho.
 *
 * El contenido crece hasta 1440px y se centra por encima; las listas de adentro
 * son libres de ocupar todo el ancho que necesiten.
 *
 * El padding inferior del `main` es grande a propósito en táctil (110px): es el
 * hueco que reserva para que la barra fija nunca tape la última fila.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <CompactAccountBar />
        <main className="mx-auto w-full max-w-(--page-max) flex-1 px-(--page-px) pt-(--page-pt) pb-(--page-pb)">
          {children}
        </main>
        <NavBottomBar />
      </div>
    </div>
  );
}
