/**
 * Quien trabaja en la pista (RN-0).
 *
 * No tiene roles ni permisos, y eso es la regla, no una simplificacion: estar
 * activo **es** su autorizacion para anotar, descontar y marcar listo. Si algun
 * dia hace falta distinguir entre empleados, se distingue por un dato del
 * empleado, nunca por un nombre de rol.
 */
export interface Employee {
  id: string;
  /** Usuario de pista. No es un correo: se escribe en una tablet (RN-18). */
  username: string;
  pinHash: string;
  fullName: string;
  /** Desactivado no entra, y sus sesiones vigentes dejan de valer (RN-13). */
  isActive: boolean;
  /**
   * Marca del ultimo cambio de PIN. Todo JWT de pista emitido antes se rechaza,
   * asi que reemplazar el PIN cierra las sesiones abiertas de ese empleado
   * (RN-18, el mismo mecanismo que `passwordChangedAt` en RN-10 de 001).
   */
  pinChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * `true` si el empleado puede iniciar sesion en la pista.
 *
 * Es una funcion de una linea a proposito: existe para que la regla tenga un
 * nombre y un solo lugar donde vivir. Cuando el taller pida "los lavadores del
 * turno de la manana no entran de noche", se cambia aca.
 */
export function canUseFloor(employee: Pick<Employee, 'isActive'>): boolean {
  return employee.isActive;
}
