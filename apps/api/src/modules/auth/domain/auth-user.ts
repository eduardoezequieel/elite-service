/**
 * Capa `domain`: TypeScript puro. Aca no entra NestJS, ni Prisma, ni Zod.
 *
 * Modela al usuario tal como lo necesita la autenticacion y las dos reglas que
 * se evaluan sobre el: la union de permisos (RN-3) y el chequeo de permisos
 * requeridos, siempre por clave `module.action` y jamas por nombre de rol
 * (RN-1).
 */

/** Un rol asignado al usuario, con las claves de permiso que agrupa. */
export interface AuthRole {
  id: string;
  /** El nombre es dato para mostrar, nunca logica de autorizacion (RN-1). */
  name: string;
  permissionKeys: string[];
}

/** El usuario completo, incluido el hash. El hash no sale nunca de esta capa. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  /** Un usuario desactivado no inicia sesion ni sostiene una abierta (RN-4). */
  isActive: boolean;
  /** Marca del ultimo cambio de contrasena; invalida los JWT anteriores (RN-10). */
  passwordChangedAt: Date;
  roles: AuthRole[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Union de los permisos de todos los roles del usuario (RN-3), sin repetidos y
 * en orden estable para que la respuesta del API no cambie sola.
 */
export function effectivePermissions(user: AuthUser): string[] {
  const keys = new Set<string>();

  for (const role of user.roles) {
    for (const key of role.permissionKeys) {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

/** `true` solo si `granted` incluye TODAS las claves de `required`. */
export function hasAllPermissions(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  const owned = new Set(granted);

  return required.every((key) => owned.has(key));
}
