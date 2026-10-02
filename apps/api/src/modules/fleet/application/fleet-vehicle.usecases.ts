import { API_ERROR_CODES } from '@elite/shared';
import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import { ConflictError, NotFoundError } from '../../../common/errors/application-error';
import {
  FleetPlateTakenError,
  installmentIncludesExtrasFor,
  plateCollides,
} from '../domain/fleet-vehicle';
import { assertCanWriteCosts, type FleetCostAccess } from './fleet-costs';
import type { FleetVehicleRepository } from './ports/fleet-vehicle.repository';

/**
 * Los carros de la rentadora (095). Se crean, se editan y cambian de estado
 * (disponible, en taller, retirado); nunca se borran (RN-6): las rentas, el
 * mantenimiento y los gastos viejos los siguen nombrando.
 *
 * Escribir costos pide `rentals.reports` (103, RN-1): por eso el alta y la
 * edición reciben el acceso de quien escribe. Lo que se lee sale entero; el
 * enmascarado lo pone la respuesta (`FleetCostsInterceptor`).
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

  async create(
    input: CreateFleetVehicleInput,
    access: FleetCostAccess = FULL_ACCESS,
  ): Promise<FleetVehicle> {
    assertCanWriteCosts(input, 'create', access);
    await this.assertPlateFree(input.plate);

    const data: CreateFleetVehicleInput = {
      ...input,
      installmentIncludesExtras: installmentIncludesExtrasFor(
        input.financed,
        input.installmentIncludesExtras,
      ),
    };

    return this.withPlate(() => this.vehicles.create(data));
  }

  async update(
    id: string,
    input: UpdateFleetVehicleInput,
    access: FleetCostAccess = FULL_ACCESS,
  ): Promise<FleetVehicle> {
    assertCanWriteCosts(input, 'update', access);

    const current = await this.vehicles.findById(id);

    if (current === null) throw notFound();

    if (input.plate !== undefined && input.plate !== current.plate) {
      await this.assertPlateFree(input.plate, id);
    }

    return this.withPlate(() => this.vehicles.update(id, withExtrasFlag(current, input)));
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

/** Quien llama desde otro caso de uso, sin un usuario detrás: ve y escribe todo. */
const FULL_ACCESS: FleetCostAccess = { canSeeCosts: true };

/** RN-2: si el carro queda sin financiamiento, la bandera se guarda en `false`. */
function withExtrasFlag(
  current: FleetVehicle,
  input: UpdateFleetVehicleInput,
): UpdateFleetVehicleInput {
  if (input.financed === undefined && input.installmentIncludesExtras === undefined) return input;

  const financed = input.financed ?? current.financed;
  const requested = input.installmentIncludesExtras ?? current.installmentIncludesExtras;
  const flag = installmentIncludesExtrasFor(financed, requested);

  return flag === current.installmentIncludesExtras && input.installmentIncludesExtras === undefined
    ? input
    : { ...input, installmentIncludesExtras: flag };
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
