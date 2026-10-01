import { PERMISSIONS, rentalSettingsSchema } from '@elite/shared';
import type { RentalSettings, RentalSettingsInput } from '@elite/shared';
import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentUser, RequirePermissions } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RentalSettingsUseCases } from '../application/rental-settings.usecases';

/**
 * `/api/rental-settings` (095): la fila única de ajustes de la rentadora.
 *
 * El `GET` no declara permiso en el decorador porque acepta una de tres claves
 * (`rentals.read`, `rentals.settings` o `fleet.read`); igual exige sesión, y el
 * caso de uso decide con los permisos que resolvió el guard.
 */
@Controller('rental-settings')
export class RentalSettingsController {
  constructor(private readonly settings: RentalSettingsUseCases) {}

  @Get()
  find(@CurrentUser() user: AuthenticatedUser): Promise<RentalSettings> {
    return this.settings.get(user.permissions);
  }

  @Put()
  @RequirePermissions(PERMISSIONS.rentals.actions.settings.key)
  update(
    @Body(new ZodValidationPipe(rentalSettingsSchema)) input: RentalSettingsInput,
  ): Promise<RentalSettings> {
    return this.settings.update(input);
  }
}
