'use client';

import type { ReactNode } from 'react';

import { usePermissions } from '../hooks/use-permissions';

/**
 * Muestra su contenido solo si el usuario tiene los permisos pedidos.
 *
 * DESIGN.md → Navigation: **oculto no es lo mismo que deshabilitado**.
 * Deshabilitado dice "no ahora"; ausente dice "esto no es tuyo". Por eso, sin
 * permiso, esto no renderiza nada en vez de renderizar un control muerto.
 *
 * Mientras la sesion se resuelve tampoco renderiza: es preferible que un boton
 * aparezca un instante tarde a que parpadee y desaparezca.
 *
 * @example
 * ```tsx
 * <RequirePermission permission="users.manage">
 *   <Button>Nuevo usuario</Button>
 * </RequirePermission>
 * ```
 */
export function RequirePermission({
  permission,
  mode = 'all',
  fallback = null,
  children,
}: {
  /** Una clave `module.action`, o varias. */
  permission: string | string[];
  /** `all` exige todas las claves; `any`, al menos una. */
  mode?: 'all' | 'any';
  /** Que mostrar cuando no tiene permiso. Por defecto, nada. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = mode === 'any' ? canAny(...required) : can(...required);

  return <>{allowed ? children : fallback}</>;
}
