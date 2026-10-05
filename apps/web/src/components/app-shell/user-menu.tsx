'use client';

import { PERMISSIONS } from '@elite/shared';
import { Contact, KeyRound, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { WorkspaceMenuItems } from '@/components/app-shell/workspace-switcher';
import { useWorkspaces } from '@/components/app-shell/nav-items';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChangePasswordDialog } from '@/features/auth/components/change-password-dialog';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useLogout, useSession } from '@/features/auth/hooks/use-session';
import { DensityMenuItems } from '@/components/density-menu';
import { ThemeMenuItems } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/**
 * Quién está usando el sistema, y cómo salir.
 *
 * Vive al pie del riel en escritorio y en la barra inferior en pantalla chica.
 * El menú se abre con toque o con teclado: nada depende de `hover`.
 */
export function UserMenu({
  collapsed = false,
  side = 'top',
  align = 'start',
  showWorkspaces = false,
  className,
}: {
  /** Riel plegado: solo el icono, sin el nombre. */
  collapsed?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  /** En la franja chica de la renta, el cambio de espacio vive acá (107). */
  showWorkspaces?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { mutate: logout, isPending } = useLogout();
  const { can } = usePermissions();
  const { active, workspaces } = useWorkspaces();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const rental = active?.key === 'rentals';
  const showCustomers = rental && can(PERMISSIONS.renters.actions.read.key);
  const showSettings = rental && can(PERMISSIONS.rentals.actions.settings.key);

  const fullName = session?.user.fullName ?? '';
  const email = session?.user.email ?? '';

  const handleLogout = () => {
    logout(undefined, {
      // Se sale igual si el servidor no contesta: la cache local ya se limpió y
      // dejar al usuario dentro de una pantalla sin sesión sería peor.
      onSettled: () => router.replace('/login'),
    });
  };

  return (
    <div className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            aria-label={fullName === '' ? 'Cuenta' : `Cuenta de ${fullName}`}
            className={cn(
              'min-h-[var(--touch-min)] min-w-[var(--touch-min)] justify-start gap-2',
              collapsed && 'justify-center px-0',
              className,
            )}
          >
            <User className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {collapsed ? null : (
              <span className="truncate text-dense font-semibold">{fullName}</span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side={side} align={align} className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-text text-dense font-semibold">{fullName}</span>
            <span className="text-text-faint text-label font-normal">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {showWorkspaces && workspaces.length > 1 ? (
            <>
              <WorkspaceMenuItems withLabel />
              <DropdownMenuSeparator />
            </>
          ) : null}
          {showCustomers ? (
            <DropdownMenuItem asChild>
              <Link href="/rentals/customers">
                <Contact className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                Clientes
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showSettings ? (
            <DropdownMenuItem asChild>
              <Link href="/rentals/settings">
                <Settings className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
                Ajustes de renta
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showCustomers || showSettings ? <DropdownMenuSeparator /> : null}
          <ThemeMenuItems />
          <DropdownMenuSeparator />
          <DensityMenuItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setPasswordOpen(true);
            }}
          >
            <KeyRound className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onSelect={handleLogout}>
            <LogOut className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
