import {
  API_ERROR_CODES,
  PERMISSIONS,
  createVehicleSchema,
  updateVehicleSchema,
} from '@elite/shared';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleBodyType,
  VehicleWithOwner,
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
import { optionalUuidQuery } from '../../../common/validation/uuid-query.pipe';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import {
  CreateVehicleUseCase,
  ListBodyTypesUseCase,
  ListVehiclesUseCase,
  UpdateVehicleUseCase,
} from '../application/vehicle.usecases';

/** Vehiculos desde la oficina. Sin `DELETE`: se desactivan (RN-13). */
@Controller('vehicles')
export class VehiclesController {
  private static readonly vehicleId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese vehículo no existe.',
      }),
  });

  private static readonly ownerId = optionalUuidQuery('customerId');

  constructor(
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly createVehicle: CreateVehicleUseCase,
    private readonly updateVehicle: UpdateVehicleUseCase,
  ) {}

  /** `customerId` trae los carros de un cliente, para su ficha (004). */
  @Get()
  @RequirePermissions(PERMISSIONS.vehicles.actions.read.key)
  findAll(
    @Query('q') query?: string,
    @Query('customerId', VehiclesController.ownerId) customerId?: string,
  ): Promise<VehicleWithOwner[]> {
    return this.listVehicles.execute({ query, customerId });
  }

  @Post()
  @RequirePermissions(PERMISSIONS.vehicles.actions.manage.key)
  create(
    @Body(new ZodValidationPipe(createVehicleSchema)) input: CreateVehicleInput,
  ): Promise<VehicleWithOwner> {
    return this.createVehicle.execute(input);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.vehicles.actions.manage.key)
  update(
    @Param('id', VehiclesController.vehicleId) id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) input: UpdateVehicleInput,
  ): Promise<VehicleWithOwner> {
    return this.updateVehicle.execute(id, input);
  }
}

/**
 * Tipos de carro. Ruta aparte porque **cualquier** sesion de oficina los
 * necesita para armar un ticket: pedir `vehicles.read` para leer un catalogo
 * cerrado de tres filas dejaria a un cajero sin poder ver un ticket.
 */
@Controller('vehicle-body-types')
export class VehicleBodyTypesController {
  constructor(private readonly listBodyTypes: ListBodyTypesUseCase) {}

  @Get()
  findAll(): Promise<VehicleBodyType[]> {
    return this.listBodyTypes.execute();
  }
}
