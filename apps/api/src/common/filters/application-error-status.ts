import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  type ApplicationError,
} from '../errors/application-error';

/**
 * Status HTTP de cada `ApplicationError` (spec 084). Vive junto al filtro y no
 * en el error: `application/` no decide status. Lo usan el filtro y los
 * helpers de test que verifican que el contrato con el web no cambió.
 */
export function applicationErrorStatus(error: ApplicationError): number {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof ValidationError) return 422;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof BadRequestError) return 400;
  return 500;
}
