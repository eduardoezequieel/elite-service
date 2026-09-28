import type { Customer, VehicleBodyType, VehicleWithOwner } from '@elite/shared';

import { currentOwnerId, planTransfer, type OwnershipRow } from '../../domain/ownership';
import type {
  NewVehicleData,
  VehicleChanges,
  VehicleFilter,
  VehicleRepository,
  VehicleWash,
} from '../ports/vehicle.repository';

interface VehicleRow {
  id: string;
  plate: string;
  bodyTypeId: string;
  make: string | null;
  color: string | null;
  isActive: boolean;
}

/**
 * Repositorio en memoria para los tests. Mismo contrato que el de Prisma: la
 * búsqueda solo ve activos, `findByPlate` y `existsByPlate` ven activos e
 * inactivos (079), y el dueño se mueve con {@link planTransfer} (RN-12).
 */
export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly rows = new Map<string, VehicleRow>();
  private readonly owners = new Map<string, OwnershipRow[]>();
  private sequence = 0;
  /** El lavado sin cobrar de cada carro. El test lo siembra (090). */
  readonly unchargedWashes = new Map<string, VehicleWash>();

  constructor(
    private readonly bodyTypes: VehicleBodyType[],
    private readonly customers: Customer[] = [],
  ) {}

  /** Siembra un vehículo ya guardado, con o sin dueño. */
  seed(row: VehicleRow, ownerId?: string): void {
    this.rows.set(row.id, row);
    this.owners.set(
      row.id,
      ownerId === undefined
        ? []
        : [{ customerId: ownerId, isCurrent: true, fromDate: new Date(0), toDate: null }],
    );
  }

  /** Las filas de propiedad, para ver qué escribió una transferencia. */
  ownershipOf(vehicleId: string): readonly OwnershipRow[] {
    return this.owners.get(vehicleId) ?? [];
  }

  async search(filter: VehicleFilter = {}): Promise<VehicleWithOwner[]> {
    const term = filter.query?.trim().toUpperCase().replace(/[\s-]/g, '') ?? '';

    return [...this.rows.values()]
      .filter((row) => row.isActive)
      .filter((row) => term === '' || row.plate.replace(/-/g, '').includes(term))
      .filter(
        (row) =>
          filter.customerId === undefined ||
          currentOwnerId(this.ownershipOf(row.id)) === filter.customerId,
      )
      .sort((a, b) => a.plate.localeCompare(b.plate))
      .map((row) => this.toVehicle(row));
  }

  async findById(id: string): Promise<VehicleWithOwner | null> {
    const row = this.rows.get(id);

    return row === undefined ? null : this.toVehicle(row);
  }

  async findByPlate(plate: string): Promise<VehicleWithOwner | null> {
    const row = [...this.rows.values()].find((candidate) => candidate.plate === plate);

    return row === undefined ? null : this.toVehicle(row);
  }

  async existsByPlate(plate: string, exceptId?: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.plate === plate && row.id !== exceptId);
  }

  async create(data: NewVehicleData): Promise<VehicleWithOwner> {
    const row: VehicleRow = {
      id: `vehicle-${++this.sequence}`,
      plate: data.plate,
      bodyTypeId: data.bodyTypeId,
      make: data.make ?? null,
      color: data.color ?? null,
      isActive: true,
    };

    this.seed(row, data.customerId);

    return this.toVehicle(row);
  }

  async update(id: string, changes: VehicleChanges): Promise<VehicleWithOwner> {
    const current = this.rows.get(id);

    if (current === undefined) throw new Error(`No existe el vehículo ${id}`);

    const { customerId, ...columns } = changes;
    const updated: VehicleRow = { ...current, ...columns };

    this.rows.set(id, updated);

    if (customerId !== undefined) this.transfer(id, customerId);

    return this.toVehicle(updated);
  }

  async listBodyTypes(): Promise<VehicleBodyType[]> {
    return [...this.bodyTypes].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async bodyTypeExists(id: string): Promise<boolean> {
    return this.bodyTypes.some((bodyType) => bodyType.id === id);
  }

  async findUnchargedWash(vehicleId: string): Promise<VehicleWash | null> {
    return this.unchargedWashes.get(vehicleId) ?? null;
  }

  private transfer(vehicleId: string, customerId: string): void {
    const rows = [...this.ownershipOf(vehicleId)];
    const plan = planTransfer(rows, customerId);
    const now = new Date();

    const next = plan.closePrevious
      ? rows.map((row) => (row.isCurrent ? { ...row, isCurrent: false, toDate: now } : row))
      : rows;

    if (plan.openNew) next.push({ customerId, isCurrent: true, fromDate: now, toDate: null });

    this.owners.set(vehicleId, next);
  }

  private toVehicle(row: VehicleRow): VehicleWithOwner {
    const bodyType = this.bodyTypes.find((candidate) => candidate.id === row.bodyTypeId);

    if (bodyType === undefined) throw new Error(`No existe el tipo de carro ${row.bodyTypeId}`);

    const ownerId = currentOwnerId(this.ownershipOf(row.id));

    return {
      id: row.id,
      plate: row.plate,
      bodyType,
      make: row.make,
      color: row.color,
      isActive: row.isActive,
      currentOwner: this.customers.find((customer) => customer.id === ownerId) ?? null,
      lastWash: null,
    };
  }
}
