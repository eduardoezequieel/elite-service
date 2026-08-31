/**
 * RN-5, puerta A: anti-lockout sobre uno mismo.
 *
 * Un usuario no puede dejarse a sí mismo sin acceso ni sin el permiso para
 * administrar roles: si pudiera, nadie podría devolvérselo salvo otro
 * administrador, y si era el único, el sistema queda cerrado para siempre.
 *
 * La evaluación es siempre sobre los **permisos efectivos resultantes** —los
 * que le quedarían si el cambio se aplicara—, nunca sobre nombres de rol
 * (RN-1). La clave crítica entra por parámetro para que este archivo no
 * dependa de nada de afuera; quien llama la toma del catálogo compartido.
 */

/** El acceso que le quedaría al solicitante si el cambio se aplicara. */
export interface ResultingAccess {
  /** Si seguiría activo. Un usuario desactivado no puede entrar (RN-4). */
  readonly isActive: boolean;
  /** Unión de los permisos de todos los roles que le quedarían (RN-3). */
  readonly permissions: readonly string[];
}

/**
 * `true` si aplicar el cambio dejaría al solicitante fuera: desactivado, o sin
 * la clave de permiso crítica. En ese caso no se cambia nada y el API responde
 * `409 SELF_LOCKOUT`.
 */
export function locksOutSelf(access: ResultingAccess, criticalPermission: string): boolean {
  if (!access.isActive) {
    return true;
  }

  return !access.permissions.includes(criticalPermission);
}
