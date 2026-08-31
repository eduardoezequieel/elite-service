import { Controller, Get } from '@nestjs/common';
import type { PermissionGroup } from '@elite/shared';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ListPermissionsUseCase } from '../application/list-permissions.usecase';

/**
 * `GET /permissions`: el catalogo agrupado por modulo que consume la matriz de
 * la pantalla de roles. Vive en el modulo de roles porque es su contracara: se
 * ve con el mismo permiso `roles.read`.
 */
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly listPermissions: ListPermissionsUseCase) {}

  @Get()
  @RequirePermissions('roles.read')
  list(): PermissionGroup[] {
    return this.listPermissions.execute();
  }
}
