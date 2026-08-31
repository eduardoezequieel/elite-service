'use client';

import type { ReactNode } from 'react';

import { Breadcrumbs } from '@/components/app-shell/breadcrumbs';
import { NavBottomBar } from '@/components/app-shell/nav-bottom-bar';
import { NavRail } from '@/components/app-shell/nav-rail';

/**
 * El armazón del área autenticada (DESIGN.md → Layout).
 *
 * Riel tabulado a la izquierda + área de contenido. Sigue sin haber barra
 * superior: lo único que va arriba del contenido es el rastro de migas, una
 * línea de texto sobre el papel que dice dónde está parado el usuario. Bajo
 * 768px el riel se muda al pie como barra de iconos y el contenido ocupa todo
 * el ancho.
 *
 * El contenido crece hasta 1440px y se centra por encima; las tablas de adentro
 * son libres de ocupar todo el ancho que necesiten.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-3 p-plate">
          <Breadcrumbs />
          {children}
        </main>
        <NavBottomBar />
      </div>
    </div>
  );
}
