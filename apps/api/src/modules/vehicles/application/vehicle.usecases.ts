import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleBodyType,
  VehicleWithOwner,
} from '@elite/shared';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import type { VehicleChanges, VehicleRepository } from './ports/vehicle.repository';

/** Un tipo de carro invalido no es un 404 del vehiculo: es un dato mal mandado. */
async function assertBodyTypeExists(
  vehicles: VehicleRepository,
  bodyTypeId: string,
): Promise<void> {
  if (!(await vehicles.bodyTypeExists(bodyTypeId))) {
    throw new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Ese tipo de carro no existe.',
      details: { bodyTypeId },
    });
  }
}

export class ListVehiclesUseCase {
  constructor(private readonly vehicles: VehicleRepository) {}

  execute(query?: string): Promise<VehicleWithOwner[]> {
    return this.vehicles.search(query);
  }
}

export class ListBodyTypesUseCase {
  constructor(private readonly vehicles: VehicleRepository) {}

  execute(): Promise<VehicleBodyType[]> {
    return this.vehicles.listBodyTypes();
  }
}

/**
 * Alta de vehiculo. La placa es unica: una placa activa = un vehiculo (RN-12).
 * La normalizacion a mayusculas y sin espacios la hace el schema Zod, asi que
 * `P 123-456` y `p123456` chocan como corresponde en vez de crear dos carros.
 */
export class CreateVehicleUseCase {
  constructor(private readonly vehicles: VehicleRepository) {}

  async execute(input: CreateVehicleInput): Promise<VehicleWithOwner> {
    if (await this.vehicles.existsByPlate(input.plate)) {
      throw new ConflictException({
        code: API_ERROR_CODES.PLATE_TAKEN,
        message: 'Ya hay un vehículo con esa placa.',
      });
    }

    await assertBodyTypeExists(this.vehicles, input.bodyTypeId);

    return this.vehicles.create(input);
  }
}

export class UpdateVehicleUseCase {
  constructor(private readonly vehicles: VehicleRepository) {}

  async execute(id: string, input: UpdateVehicleInput): Promise<VehicleWithOwner> {
    if ((await this.vehicles.findById(id)) === null) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ese vehículo no existe.',
      });
    }

    if (input.plate !== undefined && (await this.vehicles.existsByPlate(input.plate, id))) {
      throw new ConflictException({
        code: API_ERROR_CODES.PLATE_TAKEN,
        message: 'Ya hay otro vehículo con esa placa.',
      });
    }

    if (input.bodyTypeId !== undefined) {
      await assertBodyTypeExists(this.vehicles, input.bodyTypeId);
    }

    const changes: VehicleChanges = {};

    if (input.plate !== undefined) changes.plate = input.plate;
    if (input.bodyTypeId !== undefined) changes.bodyTypeId = input.bodyTypeId;
    if (input.make !== undefined) changes.make = input.make;
    if (input.color !== undefined) changes.color = input.color;
    if (input.isActive !== undefined) changes.isActive = input.isActive;
    // El repositorio decide si esto escribe historial o no (RN-12): si el
    // cliente ya es el dueno actual, no toca nada.
    if (input.customerId !== undefined) changes.customerId = input.customerId;

    return this.vehicles.update(id, changes);
  }
}
