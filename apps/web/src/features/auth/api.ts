import type {
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  SessionResponse,
} from '@elite/shared';

import { apiFetch } from '@/lib/api';

/**
 * Llamadas al API de autenticacion.
 *
 * La sesion viaja en una cookie httpOnly que el navegador maneja solo: aca no
 * se guarda ni se lee ningun token. `apiFetch` ya manda las credenciales.
 */

export function login(input: LoginInput): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

/**
 * Devuelve el usuario de la sesion con sus permisos efectivos.
 *
 * Los permisos se resuelven en el backend contra la base en cada request, asi
 * que esta respuesta siempre esta al dia: si alguien cambia un rol, se refleja
 * sin volver a iniciar sesion.
 */
export function getSession(): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/auth/me');
}

/** Cambia la clave propia. El API renueva la cookie; esta sesión sigue. */
export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiFetch<void>('/auth/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
