'use client';

import { PERMISSIONS, type PermissionKey } from '@elite/shared';
import {
  BadgeCheck,
  Droplets,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';

/**
 * Una pestaña del riel tabulado.
 *
 * Las pestañas son un dato, no código: agregar un módulo futuro es agregar una
 * entrada a `NAV_ITEMS`, nada más.
 */
export interface NavItem {
  /** Destino de la pestaña. */
  href: string;
  /** Texto visible, en español y en caja normal. */
  label: string;
  /** Icono de `lucide-react` (trazo 1.5, tamaño desde `--icon-size`). */
  icon: LucideIcon;
  /**
   * Clave `module.action` que habilita la pestaña. Sin ella, la pestaña **no se
   * renderiza**: oculta no es lo mismo que deshabilitada (DESIGN.md →
   * Navigation). Nunca se mira el nombre de un rol (RN-1).
   */
  permission: PermissionKey;
}

/**
 * Los módulos con pantalla del sistema.
 *
 * El orden de esta lista es el orden del riel, y es el del día de trabajo: lo
 * operativo arriba, la administración abajo. Un rol de cajero llega con
 * `carwash.read` y ve una sola pestaña —Lavados—; nunca el catálogo ni los
 * empleados (RN-16).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/carwash',
    label: 'Lavados',
    icon: Droplets,
    permission: PERMISSIONS.carwash.actions.read.key,
  },
  {
    href: '/settings/catalog',
    label: 'Catálogo',
    icon: Tags,
    permission: PERMISSIONS.services.actions.read.key,
  },
  {
    href: '/settings/employees',
    label: 'Empleados',
    icon: BadgeCheck,
    permission: PERMISSIONS.employees.actions.read.key,
  },
  {
    href: '/settings/users',
    label: 'Usuarios',
    icon: Users,
    permission: PERMISSIONS.users.actions.read.key,
  },
  {
    href: '/settings/roles',
    label: 'Roles',
    icon: ShieldCheck,
    permission: PERMISSIONS.roles.actions.read.key,
  },
];

/** `true` si la ruta actual pertenece a esa pestaña. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Las pestañas que este usuario puede ver, más cuál está activa.
 *
 * Mientras la sesión se resuelve no devuelve ninguna: es preferible que el riel
 * aparezca un instante tarde a que dibuje pestañas y las borre enseguida.
 */
export function useNavItems(): { items: readonly NavItem[]; pathname: string } {
  const pathname = usePathname();
  const { can, isLoading } = usePermissions();

  const items = useMemo(
    () => (isLoading ? [] : NAV_ITEMS.filter((item) => can(item.permission))),
    [can, isLoading],
  );

  return { items, pathname };
}

/**
 * Primera pantalla que este usuario puede ver, o `null` si no tiene ninguna
 * pestaña. La raiz redirige aca: nunca a una ruta que el permiso no cubre.
 */
export function firstAllowedHref(can: (key: PermissionKey) => boolean): string | null {
  return NAV_ITEMS.find((item) => can(item.permission))?.href ?? null;
}
