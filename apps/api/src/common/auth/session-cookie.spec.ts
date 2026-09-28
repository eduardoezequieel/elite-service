import { API_ERROR_CODES } from '@elite/shared';
import type { Request } from 'express';

import { attachSession, invalidSession, readSessionCookie } from './session-cookie';

function requestWith(cookies: unknown): Request {
  return { cookies } as unknown as Request;
}

describe('readSessionCookie (080)', () => {
  it('devuelve el token de la cookie pedida', () => {
    const request = requestWith({ elite_session: 'abc', elite_floor_session: 'xyz' });

    expect(readSessionCookie(request, 'elite_session')).toBe('abc');
    expect(readSessionCookie(request, 'elite_floor_session')).toBe('xyz');
  });

  it.each([
    ['sin cookie-parser', undefined],
    ['sin esa cookie', {}],
    ['vacia', { elite_session: '' }],
    ['que no es texto', { elite_session: ['abc'] }],
  ])('%s es lo mismo que no haber mandado nada', (_label, cookies) => {
    expect(readSessionCookie(requestWith(cookies), 'elite_session')).toBeUndefined();
  });
});

describe('attachSession / invalidSession (080)', () => {
  it('deja el sujeto en el request bajo la clave dada', () => {
    const request = requestWith({});

    attachSession(request, 'authenticatedUser', { id: 'u-1' });

    expect((request as unknown as Record<string, unknown>).authenticatedUser).toEqual({
      id: 'u-1',
    });
  });

  it('el 401 lleva el codigo comun', () => {
    const error = invalidSession();

    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toMatchObject({ code: API_ERROR_CODES.UNAUTHORIZED });
  });
});
