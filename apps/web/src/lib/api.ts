import type { ApiErrorCode, ApiErrorResponse } from '@elite/shared';

/**
 * Base del API. Se define como `NEXT_PUBLIC_API_URL` (ver AGENTS.md); el valor
 * por defecto cubre el entorno local para que la app arranque sin configurar
 * nada.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Codigo usado cuando la peticion nunca llego al API (red, DNS, CORS). */
const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/** Codigo usado cuando el API respondio algo que no cumple el contrato. */
const FALLBACK_ERROR_CODE: ApiErrorCode = 'INTERNAL_ERROR';

/**
 * Error normalizado de cualquier llamada al API. Siempre expone el mismo shape
 * `{ code, message, details? }` que produce el backend.
 */
export class ApiError extends Error implements ApiErrorResponse {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(payload: ApiErrorResponse, status: number) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.details = payload.details;
    this.status = status;
  }
}

/** Comprueba que un JSON desconocido cumpla el contrato de error del API. */
function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Helper minimo de acceso al API.
 *
 * - Antepone `API_BASE_URL` a las rutas relativas.
 * - Envia y espera JSON.
 * - Lanza siempre `ApiError` (nunca un error crudo de `fetch`).
 *
 * No define endpoints de negocio: cada feature declara los suyos en
 * `src/features/<module>/api.ts` y los consume con TanStack Query.
 */
export async function apiFetch<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    throw new ApiError(
      {
        code: NETWORK_ERROR_CODE,
        message: 'No se pudo conectar con el servidor.',
        details: cause,
      },
      0,
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      throw new ApiError(payload, response.status);
    }

    throw new ApiError(
      {
        code: FALLBACK_ERROR_CODE,
        message: `El servidor respondio con un error (${response.status}).`,
      },
      response.status,
    );
  }

  return payload as TResponse;
}
