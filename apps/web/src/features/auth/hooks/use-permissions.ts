'use client';

import type { PermissionKey } from '@elite/shared';
import { useMemo } from 'react';

import { useSession } from './use-session';

/**
 * Los permisos efectivos del usuario, y como preguntar por ellos.
 *
 * Se pregunta SIEMPRE por clave `module.action`, nunca por nombre de rol: los
 * roles se crean a demanda desde la administracion y no existen en el codigo.
 *
 * @example
 * ```ts
 * const { can } = usePermissions();
 * if (can('users.manage')) { ... }
 * ```
 */
export interface PermissionCheck {
  /** Las claves que tiene el usuario. Vacio si no hay sesion. */
  permissions: PermissionKey[];
  /** `true` si tiene TODAS las claves pedidas. Sin claves, `true`. */
  can: (...required: PermissionKey[]) => boolean;
  /** `true` si tiene AL MENOS UNA de las claves pedidas. */
  canAny: (...required: PermissionKey[]) => boolean;
  /** La sesion todavia se esta resolviendo: no decidas nada con esto en `true`. */
  isLoading: boolean;
}

export function usePermissions(): PermissionCheck {
  const { data: session, isPending } = useSession();

  return useMemo<PermissionCheck>(() => {
    const permissions = session?.permissions ?? [];
    const owned = new Set<PermissionKey>(permissions);

    return {
      permissions,
      can: (...required) => required.every((key) => owned.has(key)),
      canAny: (...required) => required.some((key) => owned.has(key)),
      isLoading: isPending,
    };
  }, [session, isPending]);
}
