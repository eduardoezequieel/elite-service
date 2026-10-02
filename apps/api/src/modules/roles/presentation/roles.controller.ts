import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  createRoleSchema,
  rolesQuerySchema,
  updateRoleSchema,
  type CreateRoleInput,
  type Page,
  type RolesQuery,
  type RoleDetail,
  type UpdateRoleInput,
} from '@elite/shared';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { CreateRoleUseCase } from '../application/create-role.usecase';
import { DeleteRoleUseCase } from '../application/delete-role.usecase';
import { ListRolesUseCase } from '../application/list-roles.usecase';
import { UpdateRoleUseCase } from '../application/update-role.usecase';

/** Un id que no es un uuid no puede ser ningun rol: se responde 404, no 400. */
const roleIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese rol no existe.' }),
});

/**
 * Capa `presentation`: traduce HTTP <-> caso de uso y nada mas.
 *
 * Se autoriza por clave `module.action` con `@RequirePermissions`, nunca por
 * nombre de rol (RN-1). Los guards son globales y se registran en el
 * `AppModule`: aca solo se declara el permiso que exige cada endpoint.
 */
@Controller('roles')
export class RolesController {
  constructor(
    private readonly listRoles: ListRolesUseCase,
    private readonly createRole: CreateRoleUseCase,
    private readonly updateRole: UpdateRoleUseCase,
    private readonly deleteRole: DeleteRoleUseCase,
  ) {}

  /** De a una pagina (spec 102): `?page&pageSize`. */
  @Get()
  @RequirePermissions('roles.read')
  list(
    @Query(new ZodValidationPipe(rolesQuerySchema)) query: RolesQuery,
  ): Promise<Page<RoleDetail>> {
    return this.listRoles.execute(query);
  }

  @Post()
  @RequirePermissions('roles.manage')
  create(
    @Body(new ZodValidationPipe(createRoleSchema)) input: CreateRoleInput,
  ): Promise<RoleDetail> {
    return this.createRole.execute(input);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  update(
    @Param('id', roleIdPipe) id: string,
    @Body(new ZodValidationPipe(updateRoleSchema)) input: UpdateRoleInput,
    @CurrentUser() requester: AuthenticatedUser,
  ): Promise<RoleDetail> {
    return this.updateRole.execute(id, input, requester);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('roles.manage')
  remove(@Param('id', roleIdPipe) id: string): Promise<void> {
    return this.deleteRole.execute(id);
  }
}
