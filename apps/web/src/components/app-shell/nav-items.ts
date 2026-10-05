'use client';

import { PERMISSIONS, type PermissionKey } from '@elite/shared';
import {
  BadgeCheck,
  Banknote,
  Boxes,
  CalendarDays,
  Car,
  ChartLine,
  Contact,
  Droplets,
  FileSignature,
  House,
  KeyRound,
  Landmark,
  Receipt,
  SearchCheck,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';

/**
 * Alto de una pestaña del riel, elevado al objetivo táctil en densidad `bahía`.
 * Lo comparten las pestañas y el selector de espacio (094).
 */
export const NAV_TAB_HEIGHT = 'min-h-[max(38px,var(--touch-min))]';

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
   * Navigation). Nunca se mira el nombre de un rol (RN-1). Con varias claves
   * alcanza con una: Catálogo se ve con servicios o con inventario (068).
   */
  permission: PermissionKey | readonly PermissionKey[];
}

/** `true` si el usuario puede ver la pestaña: tiene la clave, o una de ellas. */
export function navItemAllowed(item: NavItem, can: (key: PermissionKey) => boolean): boolean {
  const keys: readonly PermissionKey[] =
    typeof item.permission === 'string' ? [item.permission] : item.permission;

  return keys.some((key) => can(key));
}

/** Los espacios de trabajo que existen, en el orden del selector y del login. */
export type WorkspaceKey = 'carwash' | 'rentals' | 'admin';

/**
 * Un espacio de trabajo: uno de los negocios de la familia, o lo que es común a
 * los dos (094).
 *
 * Es un **dato**, no una ruta ni un estado guardado (RN-1): el espacio activo
 * es el de la pestaña activa. No hay «pantalla del espacio»: elegirlo lleva a su
 * primera pestaña permitida (RN-3).
 */
export interface Workspace {
  key: WorkspaceKey;
  /** Nombre visible en el selector. */
  label: string;
  /** Subtítulo de una línea en el menú del selector. */
  description: string;
  icon: LucideIcon;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    key: 'carwash',
    label: 'Lavado',
    description: 'Lavados, caja, clientes e inventario',
    icon: Droplets,
  },
  {
    key: 'rentals',
    label: 'Renta de carros',
    description: 'Flota, rentas y contratos',
    icon: KeyRound,
  },
  {
    key: 'admin',
    label: 'Administración',
    description: 'Usuarios y roles',
    icon: Settings2,
  },
];

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
  /** El espacio de trabajo al que pertenece el grupo (094, RN-1). */
  workspace: WorkspaceKey;
  items: readonly NavItem[];
}

/**
 * Los módulos con pantalla del sistema, agrupados como se leen en el riel.
 *
 * El orden es el del día de trabajo: lo operativo arriba, la administración
 * abajo. Un rol de cajero llega con `carwash.read` y ve una sola pestaña
 * —Lavados—; nunca el catálogo ni los empleados (RN-16).
 *
 * Los grupos van en el orden de los espacios —Lavado, Renta de carros,
 * Administración—: es el que recorre el login (094, RN-5). Cuentas bancarias y
 * Empleados se quedan en Lavado porque son del lavado (RN-4).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'Operación',
    workspace: 'carwash',
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
        href: '/sales',
        label: 'Ventas',
        icon: ShoppingBag,
        permission: PERMISSIONS.carwash.actions.read.key,
      },
      {
        href: '/carwash/performance',
        label: 'Rendimiento',
        icon: ChartLine,
        permission: PERMISSIONS.carwash.actions.commissions.key,
      },
      {
        href: '/customers',
        label: 'Clientes',
        icon: Contact,
        permission: PERMISSIONS.customers.actions.read.key,
      },
      {
        href: '/inventory',
        label: 'Inventario',
        icon: Boxes,
        permission: PERMISSIONS.inventory.actions.read.key,
      },
    ],
  },
  {
    label: 'Configuración',
    workspace: 'carwash',
    items: [
      {
        href: '/settings/catalog',
        label: 'Catálogo',
        icon: Tags,
        permission: [
          PERMISSIONS.services.actions.read.key,
          PERMISSIONS.combos.actions.read.key,
          PERMISSIONS.inventory.actions.read.key,
        ],
      },
      {
        href: '/settings/bank-accounts',
        label: 'Cuentas bancarias',
        icon: Landmark,
        permission: PERMISSIONS.banking.actions.manage.key,
      },
      {
        href: '/settings/employees',
        label: 'Empleados',
        icon: BadgeCheck,
        permission: PERMISSIONS.employees.actions.read.key,
      },
    ],
  },
  // Renta de carros (095): las 11 pestañas de la épica 094–100 se declaran
  // todas acá, aunque la pantalla llegue con otra spec.
  {
    label: 'Operación',
    workspace: 'rentals',
    items: [
      {
        href: '/rentals',
        label: 'Inicio',
        icon: House,
        permission: PERMISSIONS.rentals.actions.read.key,
      },
      {
        href: '/rentals/calendar',
        label: 'Calendario',
        icon: CalendarDays,
        permission: PERMISSIONS.rentals.actions.read.key,
      },
      {
        href: '/rentals/agreements',
        label: 'Rentas',
        icon: FileSignature,
        permission: PERMISSIONS.rentals.actions.read.key,
      },
      {
        href: '/rentals/availability',
        label: '¿Qué hay libre?',
        icon: SearchCheck,
        permission: PERMISSIONS.rentals.actions.read.key,
      },
      {
        href: '/rentals/cash',
        label: 'Caja',
        icon: Banknote,
        permission: PERMISSIONS.rentals.actions.charge.key,
      },
      {
        href: '/rentals/customers',
        label: 'Clientes',
        icon: Contact,
        permission: PERMISSIONS.renters.actions.read.key,
      },
    ],
  },
  {
    label: 'Flota',
    workspace: 'rentals',
    items: [
      {
        href: '/rentals/fleet',
        label: 'Flota',
        icon: Car,
        permission: PERMISSIONS.fleet.actions.read.key,
      },
      {
        href: '/rentals/maintenance',
        label: 'Mantenimiento',
        icon: Wrench,
        permission: PERMISSIONS.fleet.actions.read.key,
      },
      {
        href: '/rentals/expenses',
        label: 'Gastos',
        icon: Receipt,
        permission: PERMISSIONS.fleet.actions.read.key,
      },
      {
        href: '/rentals/profitability',
        label: 'Rentabilidad',
        icon: TrendingUp,
        permission: PERMISSIONS.rentals.actions.reports.key,
      },
    ],
  },
  {
    label: 'Configuración',
    workspace: 'rentals',
    items: [
      {
        href: '/rentals/settings',
        label: 'Ajustes',
        icon: Settings,
        permission: PERMISSIONS.rentals.actions.settings.key,
      },
    ],
  },
  {
    label: 'Administración',
    workspace: 'admin',
    items: [
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

/** La pestaña más específica que cubre la ruta, o `undefined` si ninguna. */
function activeNavHref(pathname: string): string | undefined {
  return NAV_ITEMS.map((item) => item.href)
    .filter((itemHref) => pathname === itemHref || pathname.startsWith(`${itemHref}/`))
    .sort((left, right) => right.length - left.length)[0];
}

/**
 * `true` si esta pestaña es la más específica que cubre la ruta.
 *
 * `/carwash/cash` también empieza con `/carwash`: sin el prefijo más largo,
 * Lavados y Caja quedarían activas a la vez.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return activeNavHref(pathname) === href;
}

/** Un espacio que este usuario puede ver, con la pestaña a la que lleva elegirlo. */
export interface AllowedWorkspace extends Workspace {
  /** Primera pestaña permitida del espacio (RN-3). */
  href: string;
}

/** Lo que el riel y la barra necesitan para dibujarse, ya filtrado por permiso. */
export interface WorkspaceNav {
  /** Espacios con al menos una pestaña permitida, en el orden de `WORKSPACES`. */
  workspaces: readonly AllowedWorkspace[];
  /** El espacio activo, o `null` si el usuario no tiene ninguna pestaña. */
  active: AllowedWorkspace | null;
  /** Los grupos permitidos del espacio activo, sin los que quedan vacíos. */
  sections: readonly NavSection[];
}

/**
 * Resuelve espacios, espacio activo y grupos para una ruta y unos permisos.
 *
 * Un espacio existe para el usuario solo si tiene alguna pestaña permitida
 * adentro (RN-2): ausente, no deshabilitado. El activo es el de la pestaña
 * activa; si ninguna pestaña permitida cubre la ruta, el primero (RN-1).
 */
export function resolveWorkspaceNav(
  pathname: string,
  can: (key: PermissionKey) => boolean,
): WorkspaceNav {
  const allowedSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => navItemAllowed(item, can)),
  })).filter((section) => section.items.length > 0);

  const workspaces = WORKSPACES.flatMap((workspace): AllowedWorkspace[] => {
    const first = allowedSections.find((section) => section.workspace === workspace.key)?.items[0];

    return first === undefined ? [] : [{ ...workspace, href: first.href }];
  });

  const activeHref = activeNavHref(pathname);
  const activeKey = allowedSections.find((section) =>
    section.items.some((item) => item.href === activeHref),
  )?.workspace;
  const active =
    workspaces.find((workspace) => workspace.key === activeKey) ?? workspaces[0] ?? null;

  return {
    workspaces,
    active,
    sections:
      active === null ? [] : allowedSections.filter((section) => section.workspace === active.key),
  };
}

/**
 * Espacios, espacio activo y grupos de la sesión y la ruta actuales.
 *
 * Mientras la sesión se resuelve no devuelve nada: es preferible que el riel
 * aparezca un instante tarde a que dibuje pestañas y las borre enseguida.
 */
function useWorkspaceNav(): WorkspaceNav & { pathname: string } {
  const pathname = usePathname();
  const { can, isLoading } = usePermissions();

  const nav = useMemo<WorkspaceNav>(
    () =>
      isLoading
        ? { workspaces: [], active: null, sections: [] }
        : resolveWorkspaceNav(pathname, (key) => can(key)),
    [can, isLoading, pathname],
  );

  return { ...nav, pathname };
}

/**
 * Los espacios que este usuario puede ver y cuál está activo. Con uno solo, el
 * selector no se dibuja (094).
 */
export function useWorkspaces(): {
  workspaces: readonly AllowedWorkspace[];
  active: AllowedWorkspace | null;
} {
  const { workspaces, active } = useWorkspaceNav();

  return { workspaces, active };
}

/** Los grupos del espacio activo que este usuario puede ver, más la ruta actual. */
export function useNavSections(): { sections: readonly NavSection[]; pathname: string } {
  const { sections, pathname } = useWorkspaceNav();

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
  return NAV_ITEMS.find((item) => navItemAllowed(item, can))?.href ?? null;
}

/** Igual que `firstAllowedHref`, a partir de las claves de la sesión. */
export function firstAllowedHrefFrom(permissions: readonly string[]): string | null {
  const owned = new Set(permissions);

  return firstAllowedHref((key) => owned.has(key));
}
