import type { ApiErrorCode } from '@elite/shared';

/** Lo mismo que viaja al web: `{ code, message, details? }` (regla global 6). */
export interface ApplicationErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Error que lanza un caso de uso (spec 084). No sabe de HTTP: el status lo
 * decide `AllExceptionsFilter` según la subclase, así el mismo caso de uso
 * sirve desde un controller, un job o el seed.
 */
export abstract class ApplicationError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  protected constructor({ code, message, details }: ApplicationErrorPayload) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }

  /** `{ code, message, details? }` tal cual lo manda el filtro. */
  get payload(): ApplicationErrorPayload {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/** Lo que se pidió no existe (404). */
export class NotFoundError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** Choca con el estado actual: repetido, ya cerrado, ya anulado (409). */
export class ConflictError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** Los datos llegaron bien formados pero la regla los rechaza (422). */
export class ValidationError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** Quien pide o quien firma no tiene con qué hacerlo (403). */
export class ForbiddenError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** Credenciales o sesión que no sirven (401): el web lo lee como sesión vencida. */
export class UnauthorizedError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** Pedido que no tiene sentido tal como vino (400). Hoy solo `SUPPLY_HAS_PRICE`. */
export class BadRequestError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** El archivo pasa del tope (413). Hoy solo `FILE_TOO_LARGE` (095). */
export class PayloadTooLargeError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}

/** El archivo no es de un tipo aceptado (415). Hoy solo `FILE_TYPE_NOT_ALLOWED` (095). */
export class UnsupportedMediaTypeError extends ApplicationError {
  constructor(payload: ApplicationErrorPayload) {
    super(payload);
  }
}
