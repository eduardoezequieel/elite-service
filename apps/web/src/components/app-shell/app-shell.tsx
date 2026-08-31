'use client';

import type { ReactNode } from 'react';

import { NavBottomBar } from '@/components/app-shell/nav-bottom-bar';
import { NavRail } from '@/components/app-shell/nav-rail';
import { PageBreadcrumb } from '@/components/app-shell/page-breadcrumb';

/**
 * El armazón del área autenticada (DESIGN.md → Layout).
 *
 * Riel tabulado a la izquierda + área de contenido. No hay barra superior
 * global: el riel ya dice el módulo. El rastro de ficha (breadcrumb) vive en el
 * contenido, encima del título. Bajo 768px el riel se muda al pie como barra de
 * iconos y el contenido ocupa todo el ancho.
 *
 * El contenido crece hasta 1440px y se centra por encima; las tablas de adentro
 * son libres de ocupar todo el ancho que necesiten.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-plate">
          <PageBreadcrumb />
          {children}
        </main>
        <NavBottomBar />
      </div>
    </div>
  );
}
