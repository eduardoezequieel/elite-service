import { API_ERROR_CODES } from '@elite/shared';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Lo que comparten los dos guards de sesion, oficina y pista (080): como se lee
 * la cookie, que se responde cuando no sirve y donde queda el sujeto resuelto.
 * Cada guard sigue decidiendo solo sus reglas (quien es, si esta activo, si la
 * credencial cambio despues del token).
 */

/** Un solo mensaje para todos los motivos: no se le explica al atacante. */
const SESSION_INVALID_MESSAGE = 'Tu sesión no es válida. Iniciá sesión de nuevo.';

/**
 * El token que viaja en la cookie `name`, o `undefined` si no hay uno usable.
 * `cookie-parser` deja `request.cookies`; sin el, o con un valor vacio o que no
 * sea texto, es lo mismo que no haber mandado nada.
 */
export function readSessionCookie(request: Request, name: string): string | undefined {
  const cookies = (request as { cookies?: unknown }).cookies;

  if (typeof cookies !== 'object' || cookies === null) return undefined;

  const value = (cookies as Record<string, unknown>)[name];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Deja en el request el sujeto que resolvio el guard, bajo `key`. */
export function attachSession(request: Request, key: string, session: unknown): void {
  (request as unknown as Record<string, unknown>)[key] = session;
}

/** El 401 de sesion invalida, igual para oficina y pista. */
export function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({
    code: API_ERROR_CODES.UNAUTHORIZED,
    message: SESSION_INVALID_MESSAGE,
  });
}
