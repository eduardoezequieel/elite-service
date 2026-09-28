import { API_ERROR_CODES, type ApiErrorResponse } from '@elite/shared';
import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/application-error';
import { AllExceptionsFilter, errorCodeForStatus } from './all-exceptions.filter';

function respond(exception: unknown): { status: number; body: ApiErrorResponse } {
  const sent: { status: number; body: ApiErrorResponse } = {
    status: 0,
    body: { code: API_ERROR_CODES.INTERNAL_ERROR, message: '' },
  };
  const response = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: ApiErrorResponse) {
      sent.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return sent;
}

describe('errorCodeForStatus', () => {
  it('mapea cada status al codigo del catalogo compartido', () => {
    expect(errorCodeForStatus(400)).toBe(API_ERROR_CODES.BAD_REQUEST);
    expect(errorCodeForStatus(422)).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(errorCodeForStatus(429)).toBe(API_ERROR_CODES.TOO_MANY_ATTEMPTS);
    expect(errorCodeForStatus(503)).toBe(API_ERROR_CODES.INTERNAL_ERROR);
  });
});

describe('AllExceptionsFilter', () => {
  it('respeta el code del catalogo que trae la excepcion', () => {
    const { status, body } = respond(
      new HttpException(
        { code: API_ERROR_CODES.PLATE_TAKEN, message: 'Placa repetida' },
        HttpStatus.CONFLICT,
      ),
    );

    expect(status).toBe(409);
    expect(body).toEqual({ code: API_ERROR_CODES.PLATE_TAKEN, message: 'Placa repetida' });
  });

  it('un code fuera del catalogo cae al del status', () => {
    const { body } = respond(
      new HttpException({ code: 'SOMETHING_ELSE', message: 'x' }, HttpStatus.NOT_FOUND),
    );

    expect(body.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('un 429 sin code sale como TOO_MANY_ATTEMPTS', () => {
    const { body } = respond(new HttpException('Too many', HttpStatus.TOO_MANY_REQUESTS));

    expect(body).toEqual({ code: API_ERROR_CODES.TOO_MANY_ATTEMPTS, message: 'Too many' });
  });
});

describe('AllExceptionsFilter con ApplicationError', () => {
  it('NotFoundError sale 404 con su code y mensaje', () => {
    expect(
      respond(new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'No existe' })),
    ).toEqual({ status: 404, body: { code: API_ERROR_CODES.NOT_FOUND, message: 'No existe' } });
  });

  it('ConflictError sale 409 y conserva details', () => {
    const details = { itemId: 'i-1', available: '1.000' };

    expect(
      respond(
        new ConflictError({
          code: API_ERROR_CODES.INSUFFICIENT_STOCK,
          message: 'No alcanza',
          details,
        }),
      ),
    ).toEqual({
      status: 409,
      body: { code: API_ERROR_CODES.INSUFFICIENT_STOCK, message: 'No alcanza', details },
    });
  });

  it('ValidationError sale 422', () => {
    expect(
      respond(new ValidationError({ code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Mal' })),
    ).toEqual({ status: 422, body: { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Mal' } });
  });

  it('ForbiddenError sale 403', () => {
    expect(
      respond(
        new ForbiddenError({ code: API_ERROR_CODES.AUTHORIZATION_FAILED, message: 'No firma' }),
      ),
    ).toEqual({
      status: 403,
      body: { code: API_ERROR_CODES.AUTHORIZATION_FAILED, message: 'No firma' },
    });
  });

  it('UnauthorizedError sale 401', () => {
    expect(
      respond(
        new UnauthorizedError({ code: API_ERROR_CODES.INVALID_CREDENTIALS, message: 'No entra' }),
      ),
    ).toEqual({
      status: 401,
      body: { code: API_ERROR_CODES.INVALID_CREDENTIALS, message: 'No entra' },
    });
  });

  it('BadRequestError sale 400', () => {
    expect(
      respond(
        new BadRequestError({ code: API_ERROR_CODES.SUPPLY_HAS_PRICE, message: 'Sin precio' }),
      ),
    ).toEqual({
      status: 400,
      body: { code: API_ERROR_CODES.SUPPLY_HAS_PRICE, message: 'Sin precio' },
    });
  });
});
