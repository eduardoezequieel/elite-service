import { UnprocessableEntityException } from '@nestjs/common';
import { API_ERROR_CODES, PERMISSION_KEYS } from '@elite/shared';

/**
 * RN-2: el registro de `@elite/shared` es la fuente de verdad del catalogo de
 * permisos. El schema Zod ya rechaza las claves inventadas, pero la capa de
 * aplicacion no confia a ciegas en quien la llama.
 */
const CATALOG = new Set<string>(PERMISSION_KEYS);

/** Revienta con 422 si alguna clave no existe en el catalogo (RN-2). */
export function assertPermissionKeysExist(keys: readonly string[]): void {
  const unknownKeys = keys.filter((key) => !CATALOG.has(key));

  if (unknownKeys.length > 0) {
    throw new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Hay permisos que no existen en el catálogo.',
      details: { permissionKeys: unknownKeys },
    });
  }
}
