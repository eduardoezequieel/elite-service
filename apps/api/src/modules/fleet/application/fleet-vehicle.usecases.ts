import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import { FleetPlateTakenError, plateCollides } from '../domain/fleet-vehicle';
import type { FleetVehicleRepository } from './ports/fleet-vehicle.repository';

/**
 * Los carros de la rentadora (095). Se crean, se editan y cambian de estado
 * (disponible, en taller, retirado); nunca se borran (RN-6): las rentas, el
 * mantenimiento y los gastos viejos los siguen nombrando.
 */
export class FleetVehicleUseCases {
  constructor(private readonly vehicles: FleetVehicleRepository) {}

  list(query: FleetVehiclesQuery): Promise<Page<FleetVehicle>> {
    return this.vehicles.list(query);
  }

  async get(id: string): Promise<FleetVehicle> {
    const vehicle = await this.vehicles.findById(id);

    if (vehicle === null) throw notFound();

    return vehicle;
  }

  async create(input: CreateFleetVehicleInput): Promise<FleetVehicle> {
    await this.assertPlateFree(input.plate);

    return this.withPlate(() => this.vehicles.create(input));
  }

  async update(id: string, input: UpdateFleetVehicleInput): Promise<FleetVehicle> {
    const current = await this.vehicles.findById(id);

    if (current === null) throw notFound();

    if (input.plate !== undefined && input.plate !== current.plate) {
      await this.assertPlateFree(input.plate, id);
    }

    return this.withPlate(() => this.vehicles.update(id, input));
  }

  /** RN-2: la placa es única cuando existe. */
  private async assertPlateFree(plate: string | null | undefined, exceptId?: string) {
    if (plateCollides(plate) && (await this.vehicles.existsByPlate(plate, exceptId))) {
      throw plateTaken(plate);
    }
  }

  /** Lo que se perdió en la carrera contra otra alta: el índice único chocó. */
  private async withPlate(write: () => Promise<FleetVehicle>): Promise<FleetVehicle> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof FleetPlateTakenError) throw plateTaken(error.plate);

      throw error;
    }
  }
}

function notFound(): NotFoundError {
  return new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' });
}

function plateTaken(plate: string): ConflictError {
  return new ConflictError({
    code: API_ERROR_CODES.PLATE_TAKEN,
    message: `Ya hay un carro de la flota con la placa ${plate}.`,
    details: { plate },
  });
}
