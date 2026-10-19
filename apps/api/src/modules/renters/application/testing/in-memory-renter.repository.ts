import type {
  CreateRenterInput,
  Page,
  Renter,
  RenterListItem,
  RentersQuery,
  UpdateRenterInput,
} from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import {
  compareByName,
  compareByRecent,
  matchesRenterSearch,
  renterRentalStats,
  renterSearchOf,
  type RentalForStats,
} from '../../domain/renter-list';
import type { RenterRepository } from '../ports/renter.repository';

/** Los clientes de renta en memoria. */
export class InMemoryRenterRepository implements RenterRepository {
  readonly rows: Renter[] = [];
  /** Las rentas de cada cliente, por `customerId`, para las cifras de la lista (118). */
  readonly rentals: (RentalForStats & { customerId: string })[] = [];
  private sequence = 0;

  constructor(private readonly now: Date = new Date(Date.UTC(2026, 9, 19, 18))) {}

  list(query: RentersQuery): Promise<Page<RenterListItem>> {
    const search = renterSearchOf(query.q);
    const rows = this.rows
      .filter((row) => query.blocked === undefined || row.isBlocked === query.blocked)
      .filter((row) => query.active === undefined || row.isActive === query.active)
      .filter((row) => search === null || matchesRenterSearch(row, search))
      .map((row): RenterListItem => ({
        ...row,
        ...renterRentalStats(
          this.rentals.filter((rental) => rental.customerId === row.id),
          this.now,
        ),
      }))
      .sort(query.sort === 'recent' ? compareByRecent : compareByName);

    return Promise.resolve(slicePage(rows, query));
  }

  findById(id: string): Promise<Renter | null> {
    const row = this.rows.find((candidate) => candidate.id === id);

    return Promise.resolve(row === undefined ? null : { ...row });
  }

  create(data: CreateRenterInput): Promise<Renter> {
    this.sequence += 1;
    const now = new Date(Date.UTC(2026, 9, 1, 12, this.sequence)).toISOString();
    const row: Renter = {
      id: `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`,
      fullName: data.fullName,
      documentId: data.documentId ?? null,
      licenseNumber: data.licenseNumber ?? null,
      licenseExpiresAt: data.licenseExpiresAt ?? null,
      birthDate: data.birthDate ?? null,
      country: data.country ?? null,
      mobilePhone: data.mobilePhone ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      occupation: data.occupation ?? null,
      workplace: data.workplace ?? null,
      permanentAddress: data.permanentAddress ?? null,
      permanentPhone: data.permanentPhone ?? null,
      representative: data.representative ?? null,
      isActive: true,
      isBlocked: data.isBlocked,
      blockReason: data.blockReason ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.rows.push(row);

    return Promise.resolve({ ...row });
  }

  async createMany(data: readonly CreateRenterInput[]): Promise<number> {
    for (const item of data) await this.create(item);

    return data.length;
  }

  update(id: string, changes: UpdateRenterInput): Promise<Renter> {
    const row = this.rows.find((candidate) => candidate.id === id);

    if (row === undefined) throw new Error(`Unknown renter ${id}`);

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) Object.assign(row, { [key]: value });
    }

    return Promise.resolve({ ...row });
  }
}
