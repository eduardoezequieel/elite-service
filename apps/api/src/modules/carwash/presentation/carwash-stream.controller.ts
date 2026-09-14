import { PERMISSIONS } from '@elite/shared';
import type { MessageEvent } from '@nestjs/common';
import { Controller, Inject, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { TICKET_EVENTS } from '../application/ports/ticket-events';
import type { TicketEventsStream } from '../application/ports/ticket-events';
import { ticketEventStream } from './ticket-event-stream';

/**
 * El stream de **oficina** (042).
 *
 * Mismo permiso que la lista: quien puede ver la fila puede enterarse de que se
 * movio. No hay clave nueva — un stream que mostrara mas que `GET /tickets`
 * seria una puerta de atras al mismo dato.
 */
@Controller('carwash')
export class CarwashStreamController {
  constructor(@Inject(TICKET_EVENTS) private readonly events: TicketEventsStream) {}

  @Sse('stream')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  stream(): Observable<MessageEvent> {
    return ticketEventStream(this.events, () => true);
  }
}
