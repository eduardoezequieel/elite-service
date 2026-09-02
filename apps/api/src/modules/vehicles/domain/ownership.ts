/**
 * De quien es un vehiculo, y de quien fue (RN-12).
 *
 * Una placa activa es un vehiculo y se reutiliza entre tickets: el carro que
 * vuelve el mes que viene es el mismo carro. Lo que cambia es el dueno, y ese
 * cambio no borra al anterior — el historial es lo que permite saber quien
 * trajo el carro la vez pasada.
 */

/** Una fila de propiedad. La actual tiene `toDate` nulo. */
export interface OwnershipRow {
  customerId: string;
  isCurrent: boolean;
  fromDate: Date;
  toDate: Date | null;
}

/** Lo que hay que escribir para poner a `customerId` como dueno actual. */
export interface OwnershipTransfer {
  /** `true` si hay que cerrar la fila vigente. */
  closePrevious: boolean;
  /** `true` si hay que abrir una fila nueva. */
  openNew: boolean;
}

/**
 * Que hacer cuando llega un ticket con un cliente para este vehiculo.
 *
 * Tres casos, y el del medio es el que importa: si el cliente es el mismo que
 * ya figura, **no se escribe nada**. Sin ese corte, cada lavado de un cliente
 * habitual agregaria una fila de historial identica a la anterior y la tabla
 * crecerian sin decir nada nuevo.
 */
export function planTransfer(rows: readonly OwnershipRow[], customerId: string): OwnershipTransfer {
  const current = rows.find((row) => row.isCurrent);

  if (current === undefined) return { closePrevious: false, openNew: true };
  if (current.customerId === customerId) return { closePrevious: false, openNew: false };

  return { closePrevious: true, openNew: true };
}

/** El dueno actual, o `null` si el vehiculo no tiene ninguno registrado. */
export function currentOwnerId(rows: readonly OwnershipRow[]): string | null {
  return rows.find((row) => row.isCurrent)?.customerId ?? null;
}
