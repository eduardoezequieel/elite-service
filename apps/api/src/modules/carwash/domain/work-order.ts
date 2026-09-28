import type { Cents } from './money';

/**
 * Estados de un ticket y sus transiciones (RN-9, RN-10, RN-11).
 *
 * Reglas puras. Quien puede hacer cada cosa se decide en la capa de aplicacion
 * con la sesion y los permisos; aca solo vive **que** transicion existe.
 */

export type WorkOrderStatus = 'OPEN' | 'WASHING' | 'READY' | 'PAID' | 'VOID';

/** Los tres estados de trabajo. Oficina puede ir de cualquiera a cualquiera (037). */
export type OperationalStatus = Extract<WorkOrderStatus, 'OPEN' | 'WASHING' | 'READY'>;

export const OPERATIONAL_STATUSES: readonly OperationalStatus[] = ['OPEN', 'WASHING', 'READY'];

/** Las acciones que mueven un ticket. */
export type WorkOrderAction = 'start' | 'ready' | 'reopen' | 'charge' | 'void' | 'reverse';

/**
 * Unica tabla de transiciones (RN-9). Todo lo que no este aca no existe:
 * `PAID` y `VOID` son finales, y de `OPEN` no se salta a `PAID` sin pasar por
 * `READY` —lo que se cobra es un lavado terminado.
 */
const TRANSITIONS: Record<WorkOrderAction, { from: WorkOrderStatus[]; to: WorkOrderStatus }> = {
  start: { from: ['OPEN'], to: 'WASHING' },
  ready: { from: ['OPEN', 'WASHING'], to: 'READY' },
  reopen: { from: ['READY'], to: 'OPEN' },
  charge: { from: ['READY'], to: 'PAID' },
  void: { from: ['OPEN', 'WASHING', 'READY'], to: 'VOID' },
  reverse: { from: ['PAID'], to: 'READY' },
};

/**
 * El empleado de pista solo ve y mueve lo asignado a él (036). Sin asignar
 * no es de nadie: no aparece y no se toma.
 */
export function isOwnedByEmployee(washers: readonly { id: string }[], employeeId: string): boolean {
  return washers.some((washer) => washer.id === employeeId);
}

export function isOperationalStatus(status: WorkOrderStatus): status is OperationalStatus {
  return status === 'OPEN' || status === 'WASHING' || status === 'READY';
}

/**
 * Oficina: cualquiera de los tres operativos hacia otro distinto (037).
 * `PAID` y `VOID` no entran; el mismo estado tampoco.
 */
export function canSetOperationalStatus(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return from !== to && isOperationalStatus(from) && isOperationalStatus(to);
}

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
 * El conjunto de empleados se puede cambiar en OPEN y READY. En PAID y VOID
 * el documento de dinero no se reescribe (009 RN-7).
 */
export function canEditWashers(status: WorkOrderStatus): boolean {
  return status === 'OPEN' || status === 'WASHING' || status === 'READY';
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
 * Lo minimo que hace falta para abrir un ticket (RN-7, 040).
 *
 * El responsable no esta: es opcional, en la pista se anota la placa. Marca y
 * color tampoco se exigen — con la tablet en la mano, pedirlos solo consigue
 * que alguien escriba cualquier cosa.
 *
 * `Vehicle` es lo que quien llama tiene del carro: una ficha conocida o una a
 * crear en la misma transaccion que el lavado (079). Al dominio le da igual
 * cual; solo le importa que este.
 */
export interface TicketDraft<Vehicle> {
  vehicle: Vehicle | null;
  bodyTypeId: string | null;
  serviceIds: readonly string[];
}

/** Un borrador al que no le falta nada: los mismos campos, ya sin `null`. */
export interface CompleteDraft<Vehicle> {
  vehicle: Vehicle;
  bodyTypeId: string;
  serviceIds: readonly string[];
}

/** O el borrador ya estrechado, o la lista de lo que falta (`details.missing`). */
export type DraftCheck<Vehicle> =
  { ok: true; draft: CompleteDraft<Vehicle> } | { ok: false; missing: string[] };

/**
 * Que le falta a un borrador para poder abrirse. Los nombres son los del
 * contrato (`vehicleId`, `bodyTypeId`, `items`): la pantalla los lee tal cual.
 */
export function missingFieldsOf<Vehicle>(draft: TicketDraft<Vehicle>): DraftCheck<Vehicle> {
  const { vehicle, bodyTypeId, serviceIds } = draft;
  const missing: string[] = [];

  if (vehicle === null) missing.push('vehicleId');
  if (bodyTypeId === null) missing.push('bodyTypeId');
  if (serviceIds.length === 0) missing.push('items');

  if (vehicle === null || bodyTypeId === null || missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, draft: { vehicle, bodyTypeId, serviceIds } };
}
