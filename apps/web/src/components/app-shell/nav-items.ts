'use client';

import { PERMISSIONS, type PermissionKey } from '@elite/shared';
import {
  BadgeCheck,
  Banknote,
  Contact,
  Droplets,
  Percent,
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
 * entrada a `NAV_SECTIONS`, nada más.
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
 * Un grupo de pestañas del riel.
 *
 * El grupo es la única jerarquía de navegación que existe: no hay pantalla
 * detrás de un rótulo, y por eso el enlace de regreso nunca lo nombra: se vuelve
 * a una pantalla, no a un rótulo.
 */
export interface NavSection {
  /** Rótulo del grupo, en caja normal (convención 12). */
  label: string;
  items: readonly NavItem[];
}

/**
 * Los módulos con pantalla del sistema, agrupados como se leen en el riel.
 *
 * El orden es el del día de trabajo: lo operativo arriba, la administración
 * abajo. Un rol de cajero llega con `carwash.read` y ve una sola pestaña
 * —Lavados—; nunca el catálogo ni los empleados (RN-16).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'Operación',
    items: [
      {
        href: '/carwash',
        label: 'Lavados',
        icon: Droplets,
        permission: PERMISSIONS.carwash.actions.read.key,
      },
      {
        href: '/carwash/cash',
        label: 'Caja',
        icon: Banknote,
        permission: PERMISSIONS.carwash.actions.cash.key,
      },
      {
        href: '/carwash/commissions',
        label: 'Comisiones',
        icon: Percent,
        permission: PERMISSIONS.carwash.actions.commissions.key,
      },
      {
        href: '/customers',
        label: 'Clientes',
        icon: Contact,
        permission: PERMISSIONS.customers.actions.read.key,
      },
    ],
  },
  {
    label: 'Configuración',
    items: [
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
    ],
  },
];

/** Todas las pestañas, en el orden del riel. */
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);

/**
 * `true` si esta pestaña es la más específica que cubre la ruta.
 *
 * `/carwash/cash` también empieza con `/carwash`: sin el prefijo más largo,
 * Lavados y Caja quedarían activas a la vez.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  const match = NAV_ITEMS.map((item) => item.href)
    .filter((itemHref) => pathname === itemHref || pathname.startsWith(`${itemHref}/`))
    .sort((left, right) => right.length - left.length)[0];

  return match === href;
}

/**
 * Los grupos que este usuario puede ver, sin los que quedan vacíos, más cuál es
 * la ruta actual.
 *
 * Mientras la sesión se resuelve no devuelve ninguno: es preferible que el riel
 * aparezca un instante tarde a que dibuje pestañas y las borre enseguida.
 */
export function useNavSections(): { sections: readonly NavSection[]; pathname: string } {
  const pathname = usePathname();
  const { can, isLoading } = usePermissions();

  const sections = useMemo(() => {
    if (isLoading) return [];

    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.permission)),
    })).filter((section) => section.items.length > 0);
  }, [can, isLoading]);

  return { sections, pathname };
}

/** Las mismas pestañas sin agrupar, para la barra inferior táctil. */
export function useNavItems(): { items: readonly NavItem[]; pathname: string } {
  const { sections, pathname } = useNavSections();

  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  return { items, pathname };
}

/**
 * Primera pantalla que este usuario puede ver, o `null` si no tiene ninguna
 * pestaña. El login manda acá: nunca a una ruta que el permiso no cubre.
 */
export function firstAllowedHref(can: (key: PermissionKey) => boolean): string | null {
  return NAV_ITEMS.find((item) => can(item.permission))?.href ?? null;
}

/** Igual que `firstAllowedHref`, a partir de las claves de la sesión. */
export function firstAllowedHrefFrom(permissions: readonly string[]): string | null {
  const owned = new Set(permissions);

  return firstAllowedHref((key) => owned.has(key));
}
