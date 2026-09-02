import { ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';
import { API_ERROR_CODES } from '@elite/shared';

/**
 * Un filtro `?campo=<uuid>` opcional.
 *
 * Sin esto, un id mal escrito llega hasta Prisma y vuelve como 500: el error
 * de quien llama se ve como una falla del servidor. Con esto es lo que es, un
 * dato invalido (422), con el mismo formato de error que todo lo demas.
 */
export function optionalUuidQuery(field: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    optional: true,
    exceptionFactory: () =>
      new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese filtro no es un identificador válido.',
        details: { [field]: 'uuid' },
      }),
  });
}
