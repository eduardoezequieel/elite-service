import { API_ERROR_CODES, type ApiErrorResponse } from '@elite/shared';
import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

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
