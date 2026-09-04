/**
 * Catalogo de permisos del sistema.
 *
 * La autorizacion se evalua SIEMPRE contra estas claves `module.action`, nunca
 * contra el nombre de un rol: los roles se crean a demanda desde la
 * administracion y no existen en el codigo (RN-1).
 *
 * Este registro es la fuente de verdad. El seed lo sincroniza a la base y no se
 * puede asignar a un rol una clave que no este aca (RN-2). Cada spec de modulo
 * aprobada agrega su propio grupo.
 */
export const PERMISSIONS = {
  users: {
    module: 'users',
    label: 'Usuarios',
    actions: {
      read: { key: 'users.read', label: 'Ver la lista y el detalle de usuarios' },
      manage: {
        key: 'users.manage',
        label: 'Crear, editar y desactivar usuarios, y asignarles roles',
      },
    },
  },
  roles: {
    module: 'roles',
    label: 'Roles y permisos',
    actions: {
      read: { key: 'roles.read', label: 'Ver roles y sus permisos' },
      manage: {
        key: 'roles.manage',
        label: 'Crear, editar y eliminar roles, y asignarles permisos',
      },
    },
  },

  // --- spec 003: carwash ---
  // Solo aplican a la vista de oficina (sesion `user`). El empleado de pista no
  // tiene permisos: estar activo es su autorizacion (RN-0).
  employees: {
    module: 'employees',
    label: 'Empleados',
    actions: {
      read: { key: 'employees.read', label: 'Ver la lista de empleados' },
      manage: {
        key: 'employees.manage',
        label: 'Crear, editar y desactivar empleados, y reemplazar su PIN',
      },
    },
  },
  customers: {
    module: 'customers',
    label: 'Clientes',
    actions: {
      read: { key: 'customers.read', label: 'Ver clientes' },
      manage: { key: 'customers.manage', label: 'Crear y editar clientes' },
    },
  },
  vehicles: {
    module: 'vehicles',
    label: 'Vehículos',
    actions: {
      read: { key: 'vehicles.read', label: 'Ver vehículos' },
      manage: { key: 'vehicles.manage', label: 'Crear y editar vehículos' },
    },
  },
  services: {
    module: 'services',
    label: 'Catálogo',
    actions: {
      read: { key: 'services.read', label: 'Ver el catálogo de servicios y precios' },
      manage: {
        key: 'services.manage',
        label: 'Crear, editar y desactivar categorías, servicios y la matriz de precios',
      },
    },
  },
  carwash: {
    module: 'carwash',
    label: 'Lavados',
    actions: {
      read: { key: 'carwash.read', label: 'Ver la fila de lavados de oficina' },
      manage: {
        key: 'carwash.manage',
        label: 'Abrir lavados de emergencia, editar los abiertos, marcar listo y reabrir',
      },
      charge: {
        key: 'carwash.charge',
        label: 'Cobrar un lavado listo. No edita servicios ni precios',
      },
      cash: {
        key: 'carwash.cash',
        label: 'Ver el turno de caja, abrirlo y cerrarlo',
      },
      void: { key: 'carwash.void', label: 'Anular un lavado abierto o listo' },
      commissions: {
        key: 'carwash.commissions',
        label: 'Ver el reporte de comisiones y el total a pagar',
      },
    },
  },
} as const;

/** Un grupo del catalogo: un modulo con sus acciones. */
export type PermissionModule = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Todas las claves validas, aplanadas. Es lo que consumen el guard del backend
 * y el `usePermissions()` del frontend.
 */
export const PERMISSION_KEYS = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group.actions).map((action) => action.key),
);

/** Union de las claves de permiso validas. */
export type PermissionKey =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['actions'][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]['actions']]['key'];

/** Descripcion de un permiso, tal como la devuelve `GET /permissions`. */
export interface PermissionDescriptor {
  key: string;
  label: string;
}

/** El catalogo agrupado por modulo, listo para la matriz de la pantalla de roles. */
export interface PermissionGroup {
  module: string;
  label: string;
  permissions: PermissionDescriptor[];
}

/** Devuelve el catalogo en la forma que consume la UI y el endpoint. */
export function listPermissionGroups(): PermissionGroup[] {
  return Object.values(PERMISSIONS).map((group) => ({
    module: group.module,
    label: group.label,
    permissions: Object.values(group.actions).map((action) => ({
      key: action.key,
      label: action.label,
    })),
  }));
}

/** `true` si la clave existe en el catalogo. */
export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(value);
}
