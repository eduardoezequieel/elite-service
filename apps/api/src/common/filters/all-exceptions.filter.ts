import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { API_ERROR_CODES, errorCodeForStatus } from '../errors/api-error';
import type { ApiErrorResponse } from '../errors/api-error';

/**
 * Filtro global: normaliza CUALQUIER excepción al contrato `ApiErrorResponse`.
 * Es el único lugar donde se construye la respuesta de error del API.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status = this.resolveStatus(exception);
    const body = this.toApiError(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toApiError(exception: unknown, status: number): ApiErrorResponse {
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Nunca se filtran detalles internos al cliente.
      return {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      };
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { code: errorCodeForStatus(status), message: payload };
      }

      if (payload !== null && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        const code = typeof record.code === 'string' ? record.code : errorCodeForStatus(status);
        const message = this.extractMessage(record) ?? exception.message;
        const details = record.details ?? this.validationDetails(record);

        return details === undefined ? { code, message } : { code, message, details };
      }

      return { code: errorCodeForStatus(status), message: exception.message };
    }

    return { code: errorCodeForStatus(status), message: 'Unexpected error' };
  }

  private extractMessage(record: Record<string, unknown>): string | undefined {
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (Array.isArray(record.message) && record.message.length > 0) {
      return String(record.message[0]);
    }
    return undefined;
  }

  /** Los errores de validación de Nest llegan como `message: string[]`. */
  private validationDetails(record: Record<string, unknown>): unknown {
    return Array.isArray(record.message) ? { issues: record.message } : undefined;
  }
}
