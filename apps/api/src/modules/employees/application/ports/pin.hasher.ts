/**
 * Puerto de hash del PIN. Se separa del de contrasenas de 001 porque son
 * mundos distintos (RN-0) y porque el PIN podria pedir otro costo algun dia;
 * hoy los dos usan bcrypt factor 12 (RN-18).
 */
export interface PinHasher {
  hash(pin: string): Promise<string>;
  /** Compara en tiempo constante. Nunca se loguea ni el PIN ni el hash. */
  verify(pin: string, hash: string): Promise<boolean>;
}

export const PIN_HASHER = Symbol('employees.PinHasher');
