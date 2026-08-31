import { API_ERROR_CODES, PERMISSIONS, createUserSchema, updateUserSchema } from '@elite/shared';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { CreateUserUseCase } from '../application/create-user.usecase';
import { ListUsersUseCase } from '../application/list-users.usecase';
import { UpdateUserUseCase } from '../application/update-user.usecase';

/**
 * Capa `presentation`: valida la entrada, llama al caso de uso y devuelve. Sin
 * lógica de negocio.
 *
 * No hay `DELETE`: los usuarios se desactivan con `PATCH { isActive: false }`,
 * nunca se eliminan (RN-4).
 *
 * Los guards de sesión y de permisos son globales y los registra el
 * `AppModule`; acá sólo se declara qué clave `module.action` exige cada
 * endpoint, nunca un nombre de rol (RN-1).
 */
@Controller('users')
export class UsersController {
  /** Un id que ni siquiera es un uuid no puede ser de nadie: 404, no 400. */
  private static readonly userId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese usuario no existe.',
      }),
  });

  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.users.actions.read.key)
  findAll(): Promise<PublicUser[]> {
    return this.listUsers.execute();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.users.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
  ): Promise<PublicUser> {
    return this.createUser.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.users.actions.manage.key)
  update(
    @Param('id', UsersController.userId) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) input: UpdateUserInput,
    @CurrentUser() requester: AuthenticatedUser,
  ): Promise<PublicUser> {
    // El solicitante entra sólo para la puerta A del anti-lockout (RN-5).
    return this.updateUser.execute({ userId: id, requesterId: requester.id, input });
  }
}
