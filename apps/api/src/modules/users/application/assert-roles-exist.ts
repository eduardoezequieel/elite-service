import { API_ERROR_CODES } from '@elite/shared';
import { UnprocessableEntityException } from '@nestjs/common';

import type { RoleDirectory } from './ports/role.directory';

/**
 * Un `roleId` inexistente no es un error de formato: el uuid está bien escrito
 * pero no hay rol detrás. Por eso `422 INVALID_ROLE` y no `400`, con las claves
 * inválidas en `details` para que el formulario pueda marcar el campo.
 *
 * Lo comparten crear y actualizar usuario, que aplican la misma regla.
 */
export async function assertRolesExist(
  roles: RoleDirectory,
  roleIds: readonly string[],
): Promise<void> {
  if (roleIds.length === 0) {
    return;
  }

  const existing = new Set(await roles.findExistingIds(roleIds));
  const missing = [...new Set(roleIds)].filter((roleId) => !existing.has(roleId));

  if (missing.length > 0) {
    throw new UnprocessableEntityException({
      code: API_ERROR_CODES.INVALID_ROLE,
      message: 'Alguno de los roles que enviaste ya no existe.',
      details: { roleIds: missing },
    });
  }
}
