import {
  API_ERROR_CODES,
  PERMISSIONS,
  createRenterSchema,
  importRentersSchema,
  rentersQuerySchema,
  updateRenterSchema,
} from '@elite/shared';
import type {
  CreateRenterInput,
  ImportRentersInput,
  Page,
  Renter,
  RenterImportResult,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermissions } from '../../../common/auth/auth.decorators';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RenterUseCases } from '../application/renter.usecases';

const { read, manage } = PERMISSIONS.renters.actions;

/** `/api/renters` (095): los clientes de renta. Sin `DELETE` (RN-6). */
@Controller('renters')
export class RentersController {
  private static readonly renterId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese cliente no existe.' }),
  });

  constructor(private readonly renters: RenterUseCases) {}

  @Get()
  @RequirePermissions(read.key)
  findAll(
    @Query(new ZodValidationPipe(rentersQuerySchema)) query: RentersQuery,
  ): Promise<Page<Renter>> {
    return this.renters.list(query);
  }

  @Get(':id')
  @RequirePermissions(read.key)
  findOne(@Param('id', RentersController.renterId) id: string): Promise<Renter> {
    return this.renters.get(id);
  }

  @Post()
  @RequirePermissions(manage.key)
  create(
    @Body(new ZodValidationPipe(createRenterSchema)) input: CreateRenterInput,
  ): Promise<Renter> {
    return this.renters.create(input);
  }

  /** 200 y no 201: puede no crear nada si todas las filas se omiten. */
  @Post('import')
  @HttpCode(200)
  @RequirePermissions(manage.key)
  import(
    @Body(new ZodValidationPipe(importRentersSchema)) input: ImportRentersInput,
  ): Promise<RenterImportResult> {
    return this.renters.import(input);
  }

  @Patch(':id')
  @RequirePermissions(manage.key)
  update(
    @Param('id', RentersController.renterId) id: string,
    @Body(new ZodValidationPipe(updateRenterSchema)) input: UpdateRenterInput,
  ): Promise<Renter> {
    return this.renters.update(id, input);
  }
}
