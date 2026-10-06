import type {
  CreateFleetVehicleInput,
  FleetVehicle,
  FleetVehiclesQuery,
  Page,
  UpdateFleetVehicleInput,
} from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { FleetPlateTakenError } from '../../domain/fleet-vehicle';
import type { FleetVehicleRepository } from '../ports/fleet-vehicle.repository';

const STATUS_ORDER = { ACTIVE: 0, IN_SHOP: 1, RETIRED: 2 } as const;

/** La flota en memoria, con el mismo índice único de placa que la base. */
export class InMemoryFleetVehicleRepository implements FleetVehicleRepository {
  readonly rows: FleetVehicle[] = [];
  private sequence = 0;

  list(query: FleetVehiclesQuery): Promise<Page<FleetVehicle>> {
    const term = query.q?.toLowerCase();
    const rows = this.rows
      .filter((row) =>
        query.status === undefined ? row.status !== 'RETIRED' : row.status === query.status,
      )
      .filter(
        (row) =>
          term === undefined ||
          term === '' ||
          [row.plate, row.make, row.model, row.color].some((value) =>
            value?.toLowerCase().includes(term),
          ),
      )
      .sort(
        (left, right) =>
          STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
          left.make.localeCompare(right.make) ||
          left.model.localeCompare(right.model) ||
          left.id.localeCompare(right.id),
      );

    return Promise.resolve(
      slicePage(
        rows.map((row) => ({ ...row })),
        query,
      ),
    );
  }

  findById(id: string): Promise<FleetVehicle | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  existsByPlate(plate: string, exceptId?: string): Promise<boolean> {
    return Promise.resolve(this.taken(plate, exceptId));
  }

  create(data: CreateFleetVehicleInput): Promise<FleetVehicle> {
    if (data.plate && this.taken(data.plate)) throw new FleetPlateTakenError(data.plate);

    this.sequence += 1;
    const now = new Date(Date.UTC(2026, 9, 1, 12, this.sequence)).toISOString();
    const row: FleetVehicle = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      plate: data.plate ?? null,
      make: data.make,
      model: data.model,
      year: data.year ?? null,
      color: data.color ?? null,
      category: data.category,
      status: 'ACTIVE',
      dailyRate: data.dailyRate,
      weeklyRate: data.weeklyRate ?? null,
      monthlyRate: data.monthlyRate ?? null,
      freeKmPerDay: data.freeKmPerDay ?? null,
      extraKmPrice: data.extraKmPrice ?? null,
      odometerKm: data.odometerKm,
      purchasePrice: data.purchasePrice ?? null,
      purchasedAt: data.purchasedAt ?? null,
      financed: data.financed,
      downPayment: data.downPayment ?? null,
      installment: data.installment ?? null,
      termMonths: data.termMonths ?? null,
      financingStartedAt: data.financingStartedAt ?? null,
      installmentIncludesExtras: data.installmentIncludesExtras,
      insuranceMonthly: data.insuranceMonthly ?? null,
      gpsMonthly: data.gpsMonthly ?? null,
      otherFixedMonthly: data.otherFixedMonthly ?? null,
      insurer: data.insurer ?? null,
      policyNumber: data.policyNumber ?? null,
      insuranceExpiresAt: data.insuranceExpiresAt ?? null,
      registrationExpiresAt: data.registrationExpiresAt ?? null,
      notes: data.notes ?? null,
      availability: null,
      alerts: [],
      costsHidden: false,
      createdAt: now,
      updatedAt: now,
    };

    this.rows.push(row);

    return Promise.resolve({ ...row });
  }

  update(id: string, changes: UpdateFleetVehicleInput): Promise<FleetVehicle> {
    const row = this.rows.find((candidate) => candidate.id === id);

    if (row === undefined) throw new Error(`Unknown fleet vehicle ${id}`);
    if (changes.plate && this.taken(changes.plate, id)) {
      throw new FleetPlateTakenError(changes.plate);
    }

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) Object.assign(row, { [key]: value });
    }

    return Promise.resolve({ ...row });
  }

  private taken(plate: string, exceptId?: string): boolean {
    return this.rows.some((row) => row.plate === plate && row.id !== exceptId);
  }
}
