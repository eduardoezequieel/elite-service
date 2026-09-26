import { PERMISSIONS } from '@elite/shared';
import type { MessageEvent } from '@nestjs/common';
import { Controller, Inject, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { TICKET_EVENTS } from '../application/ports/ticket-events';
import type { TicketEventsStream } from '../application/ports/ticket-events';
import { isVisibleToUser } from '../domain/carwash-event';
import { ticketEventStream } from './ticket-event-stream';

/**
 * El stream de **oficina** (042).
 *
 * Mismo permiso que la lista: quien puede ver la fila puede enterarse de que se
 * movio. No hay clave nueva — un stream que mostrara mas que `GET /tickets`
 * seria una puerta de atras al mismo dato.
 *
 * Por el mismo hilo viajan los avisos de minimo del inventario (065 RN-13),
 * solo para quien tiene `inventory.read` (`isVisibleToUser`).
 */
@Controller('carwash')
export class CarwashStreamController {
  constructor(@Inject(TICKET_EVENTS) private readonly events: TicketEventsStream) {}

  @Sse('stream')
  @RequirePermissions(PERMISSIONS.carwash.actions.read.key)
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return ticketEventStream(
      (listener) => this.events.subscribeLive(listener),
      (event) => isVisibleToUser(event, user.permissions),
    );
  }
}
