import type { CarwashEventType } from '@elite/shared';

import type { WorkOrderAction, WorkOrderStatus } from './work-order';
import { isOwnedByEmployee, isOperationalStatus } from './work-order';

/**
 * Que evento corresponde a cada accion del ticket (042). Reglas puras: aca no
 * se decide quien puede hacerla, solo como se llama lo que paso.
 */
const EVENT_BY_ACTION: Record<WorkOrderAction, CarwashEventType> = {
  start: 'ticket.status.changed',
  ready: 'ticket.status.changed',
  reopen: 'ticket.status.changed',
  charge: 'ticket.charged',
  void: 'ticket.voided',
  reverse: 'ticket.reversed',
};

export function eventTypeFor(action: WorkOrderAction): CarwashEventType {
  return EVENT_BY_ACTION[action];
}

/** Lo minimo de un evento para decidir si la pista puede verlo. */
export interface VisibilityCheck {
  status: WorkOrderStatus;
  washers: { id: string }[];
}

/**
 * Si el empleado de pista puede enterarse de este lavado.
 *
 * Es la regla de la spec 036 —en pista nadie ve el lavado de otro, ni uno sin
 * asignar— aplicada al stream. Vive aca y no en el filtro del controller a
 * proposito: el recorte de `GET /floor/tickets` y el del stream tienen que ser
 * el mismo, o el empuje filtraria lo que la lista esconde.
 *
 * Los cobrados y los anulados tampoco viajan: la fila de pista nunca los
 * muestra.
 */
export function isVisibleToEmployee(ticket: VisibilityCheck, employeeId: string): boolean {
  return isOperationalStatus(ticket.status) && isOwnedByEmployee(ticket.washers, employeeId);
}
