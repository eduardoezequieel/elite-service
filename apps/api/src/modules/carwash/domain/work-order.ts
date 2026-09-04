import type { Cents } from './money';

/**
 * Estados de un ticket y sus transiciones (RN-9, RN-10, RN-11).
 *
 * Reglas puras. Quien puede hacer cada cosa se decide en la capa de aplicacion
 * con la sesion y los permisos; aca solo vive **que** transicion existe.
 */

export type WorkOrderStatus = 'OPEN' | 'READY' | 'PAID' | 'VOID';

/** Las acciones que mueven un ticket. */
export type WorkOrderAction = 'ready' | 'reopen' | 'charge' | 'void';

/**
 * Unica tabla de transiciones (RN-9). Todo lo que no este aca no existe:
 * `PAID` y `VOID` son finales, y de `OPEN` no se salta a `PAID` sin pasar por
 * `READY` —lo que se cobra es un lavado terminado.
 */
const TRANSITIONS: Record<WorkOrderAction, { from: WorkOrderStatus[]; to: WorkOrderStatus }> = {
  ready: { from: ['OPEN'], to: 'READY' },
  reopen: { from: ['READY'], to: 'OPEN' },
  charge: { from: ['READY'], to: 'PAID' },
  void: { from: ['OPEN', 'READY'], to: 'VOID' },
};

/** `true` si la accion es valida desde ese estado. */
export function canTransition(status: WorkOrderStatus, action: WorkOrderAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** El estado al que lleva la accion, o `null` si no es valida desde ahi. */
export function nextStatus(
  status: WorkOrderStatus,
  action: WorkOrderAction,
): WorkOrderStatus | null {
  return canTransition(status, action) ? TRANSITIONS[action].to : null;
}

/** Un ticket solo se edita mientras esta abierto (RN-9). */
export function isEditable(status: WorkOrderStatus): boolean {
  return status === 'OPEN';
}

/**
 * El conjunto de lavadores se puede cambiar en OPEN y READY. En PAID y VOID
 * el documento de dinero no se reescribe (009 RN-7).
 */
export function canEditWashers(status: WorkOrderStatus): boolean {
  return status === 'OPEN' || status === 'READY';
}

/** Por que un cobro no procede. */
export type ChargeRejection = 'NOT_READY' | 'AMOUNT_MISMATCH' | 'EMPTY_TOTAL';

/**
 * Valida un cobro (RN-10).
 *
 * Un solo pago, por el **total exacto**: no hay saldo, ni abonos, ni vuelto que
 * el sistema deba calcular. Y el total tiene que ser mayor que cero — un ticket
 * en 0 es una cortesia, y una cortesia no se cobra: se anula (RN-5).
 *
 * Devuelve `null` si el cobro procede, o el motivo del rechazo.
 */
export function rejectCharge(
  status: WorkOrderStatus,
  total: Cents,
  amount: Cents,
): ChargeRejection | null {
  if (!canTransition(status, 'charge')) return 'NOT_READY';
  if (total <= 0) return 'EMPTY_TOTAL';
  if (amount !== total) return 'AMOUNT_MISMATCH';

  return null;
}

/**
 * Lo minimo que hace falta para abrir un ticket (RN-7).
 *
 * Marca y color son opcionales a proposito: en la pista, exigirlos con la
 * tablet en la mano y el carro esperando solo consigue que alguien escriba
 * cualquier cosa.
 */
export interface TicketDraft {
  customerId: string | null;
  vehicleId: string | null;
  bodyTypeId: string | null;
  serviceIds: readonly string[];
}

/** Que le falta a un borrador para poder abrirse. Vacio = esta completo. */
export function missingFieldsOf(draft: TicketDraft): string[] {
  const missing: string[] = [];

  if (draft.customerId === null) missing.push('customerId');
  if (draft.vehicleId === null) missing.push('vehicleId');
  if (draft.bodyTypeId === null) missing.push('bodyTypeId');
  if (draft.serviceIds.length === 0) missing.push('items');

  return missing;
}
