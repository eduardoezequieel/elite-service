import { API_ERROR_CODES } from '@elite/shared';

import { ConflictError } from '../../../common/errors/application-error';
import { toReferenceLabel } from '../domain/numbering';
import type { UnchargedWash } from './ports/ticket.repository';

/**
 * El 409 de un carro que ya tiene un lavado sin cobrar (090 RN-1). Un solo
 * texto para el alta, el reverso y la baja del carro. Sin `wash` —lo freno el
 * unico de la base y no se sabe cual es— sale sin `details`.
 */
export function vehicleBusy(wash: UnchargedWash | null, hint?: string): ConflictError {
  const head =
    wash === null
      ? 'Ese carro ya tiene un lavado sin cobrar.'
      : `${wash.plate} ya tiene un lavado sin cobrar (${toReferenceLabel(wash.number)}).`;

  return new ConflictError({
    code: API_ERROR_CODES.VEHICLE_HAS_ACTIVE_TICKET,
    message: hint === undefined ? head : `${head} ${hint}`,
    ...(wash === null
      ? {}
      : {
          details: {
            ticketId: wash.id,
            number: wash.number,
            plate: wash.plate,
            status: wash.status,
          },
        }),
  });
}
