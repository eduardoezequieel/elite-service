'use client';

import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout, useSession } from '@/features/auth/hooks/use-session';
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
  className,
}: {
  /** Riel plegado: solo el icono, sin el nombre. */
  collapsed?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { mutate: logout, isPending } = useLogout();

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
          {collapsed ? null : <span className="truncate text-label">{fullName}</span>}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side={side} align={align} className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-label text-foreground">{fullName}</span>
          <span className="text-muted-foreground text-label font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isPending} onSelect={handleLogout}>
          <LogOut className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          {isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
