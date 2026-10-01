import {
  API_ERROR_CODES,
  PERMISSIONS,
  createFleetVehicleSchema,
  fleetVehiclesQuerySchema,
  updateFleetVehicleSchema,
} from '@elite/shared';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  UpdateFleetVehicleInput,
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
import { FleetVehicleUseCases } from '../application/fleet-vehicle.usecases';

const { read, manage } = PERMISSIONS.fleet.actions;

/** `/api/fleet/vehicles` (095). Sin `DELETE`: un carro se retira (RN-6). */
@Controller('fleet/vehicles')
export class FleetController {
  private static readonly vehicleId = new ParseUUIDPipe({
    exceptionFactory: () =>
      new NotFoundException({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' }),
  });

  constructor(private readonly fleet: FleetVehicleUseCases) {}

  @Get()
  @RequirePermissions(read.key)
  findAll(
    @Query(new ZodValidationPipe(fleetVehiclesQuerySchema)) query: FleetVehiclesQuery,
  ): Promise<FleetVehicle[]> {
    return this.fleet.list(query);
  }

  @Get(':id')
  @RequirePermissions(read.key)
  findOne(@Param('id', FleetController.vehicleId) id: string): Promise<FleetVehicle> {
    return this.fleet.get(id);
  }

  @Post()
  @RequirePermissions(manage.key)
  create(
    @Body(new ZodValidationPipe(createFleetVehicleSchema)) input: CreateFleetVehicleInput,
  ): Promise<FleetVehicle> {
    return this.fleet.create(input);
  }

  @Patch(':id')
  @RequirePermissions(manage.key)
  update(
    @Param('id', FleetController.vehicleId) id: string,
    @Body(new ZodValidationPipe(updateFleetVehicleSchema)) input: UpdateFleetVehicleInput,
  ): Promise<FleetVehicle> {
    return this.fleet.update(id, input);
  }
}
