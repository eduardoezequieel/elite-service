import type { MessageEvent } from '@nestjs/common';
import { Controller, Inject, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { CurrentEmployee, FloorSession } from '../../../common/auth/auth.decorators';
import type { AuthenticatedEmployee } from '../../../common/auth/authenticated-user';
import { TICKET_EVENTS } from '../application/ports/ticket-events';
import type { TicketEventsStream } from '../application/ports/ticket-events';
import { isVisibleToEmployee } from '../domain/carwash-event';
import { ticketEventStream } from './ticket-event-stream';

/**
 * El stream de **pista** (042).
 *
 * Recorta por empleado con la misma regla que `GET /floor/tickets` (036): el
 * lavado de otro, el que no tiene asignado y el cobrado o anulado no viajan.
 * El recorte es del servidor, no de la tablet.
 */
@Controller('floor')
@FloorSession()
export class FloorStreamController {
  constructor(@Inject(TICKET_EVENTS) private readonly events: TicketEventsStream) {}

  @Sse('stream')
  stream(@CurrentEmployee() employee: AuthenticatedEmployee): Observable<MessageEvent> {
    return ticketEventStream(this.events, (event) =>
      isVisibleToEmployee(event.ticket, employee.id),
    );
  }
}
