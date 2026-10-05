import {
  API_ERROR_CODES,
  PERMISSIONS,
  combosQuerySchema,
  createComboSchema,
  updateComboSchema,
} from '@elite/shared';
import type {
  ComboDetail,
  CombosQuery,
  CreateComboInput,
  Page,
  UpdateComboInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { ComboUseCases } from '../application/combo.usecases';

/**
 * La pestaña Combos del catálogo (104). Los combos de hoy para el alta del
 * lavado no salen de acá sino de `/carwash/combos` y `/floor/combos`, con el
 * permiso y la sesión del lavado.
 */
@Controller('combos')
export class CombosController {
  private static readonly comboId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese combo no existe.' }),
  });

  constructor(private readonly combos: ComboUseCases) {}

  @Get()
  @RequirePermissions(PERMISSIONS.combos.actions.read.key)
  findAll(
    @Query(new ZodValidationPipe(combosQuerySchema)) query: CombosQuery,
  ): Promise<Page<ComboDetail>> {
    return this.combos.listPage(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.combos.actions.read.key)
  findOne(@Param('id', CombosController.comboId) id: string): Promise<ComboDetail> {
    return this.combos.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.combos.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createComboSchema)) input: CreateComboInput,
  ): Promise<ComboDetail> {
    return this.combos.create(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.combos.actions.manage.key)
  update(
    @Param('id', CombosController.comboId) id: string,
    @Body(new ZodValidationPipe(updateComboSchema)) input: UpdateComboInput,
  ): Promise<ComboDetail> {
    return this.combos.update(id, input);
  }
}
