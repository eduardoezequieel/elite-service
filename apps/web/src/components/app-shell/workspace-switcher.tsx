'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';

import { NAV_TAB_HEIGHT, useWorkspaces } from '@/components/app-shell/nav-items';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/** Rótulo del selector y del grupo dentro de «Más». */
const WORKSPACE_LABEL = 'Espacio de trabajo';

/**
 * Los espacios como ítems de un menú que ya existe: el del selector del riel y
 * el «Más» de la barra inferior (094).
 *
 * Elegir uno navega a su primera pestaña permitida (RN-3); el activo lleva el
 * `Check`, además del nombre en negrita: nunca solo una señal.
 */
export function WorkspaceMenuItems({ withLabel = false }: { withLabel?: boolean }) {
  const { workspaces, active } = useWorkspaces();

  if (workspaces.length < 2) return null;

  return (
    <>
      {withLabel ? (
        <DropdownMenuLabel className="text-text-faint text-label">
          {WORKSPACE_LABEL}
        </DropdownMenuLabel>
      ) : null}
      {workspaces.map((workspace) => {
        const Icon = workspace.icon;
        const current = workspace.key === active?.key;

        return (
          <DropdownMenuItem key={workspace.key} asChild>
            <Link href={workspace.href} aria-current={current ? 'page' : undefined}>
              <Icon className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn('truncate', current && 'font-semibold')}>
                  {workspace.label}
                </span>
                <span className="text-text-faint truncate text-label">{workspace.description}</span>
              </span>
              {current ? (
                <Check
                  className="size-icon text-flame ml-auto"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden
                />
              ) : null}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/**
 * El selector de espacio de trabajo, arriba del riel (DESIGN.md → Menú lateral
 * y barra inferior).
 *
 * Con un solo espacio no se renderiza: un cajero con permisos de un solo
 * negocio ve el riel de siempre, sin un selector que no elige nada.
 *
 * Vive sobre el azul marino del riel en los dos temas, así que usa los colores
 * del riel y no los del tema. Plegado queda el icono, con el nombre del espacio
 * en `aria-label`.
 */
export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { workspaces, active } = useWorkspaces();

  if (workspaces.length < 2 || active === null) return null;

  const Icon = active.icon;

  return (
    <div data-slot="workspace-switcher" className="flex flex-col gap-1.5">
      <span className={cn('text-rail-faint ml-2 text-label font-semibold', collapsed && 'sr-only')}>
        {WORKSPACE_LABEL}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${WORKSPACE_LABEL}: ${active.label}`}
            title={collapsed ? active.label : undefined}
            className={cn(
              'text-rail-text flex w-full items-center gap-2.5 rounded-(--nav-item-radius) border border-white/8 bg-white/5 px-2.5 py-2 text-body font-medium transition-colors duration-(--duration-state) ease-standard hover:bg-white/8',
              NAV_TAB_HEIGHT,
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon
              className="size-icon text-flame shrink-0"
              strokeWidth={ICON_STROKE_WIDTH}
              aria-hidden
            />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1 truncate text-left">{active.label}</span>
                <ChevronsUpDown
                  className="size-icon text-rail-dim shrink-0"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden
                />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side={collapsed ? 'right' : 'bottom'}
          align="start"
          className="min-w-64"
        >
          <WorkspaceMenuItems withLabel />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
