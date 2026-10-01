import type { CreateRenterInput, Renter, RentersQuery, UpdateRenterInput } from '@elite/shared';

import type { RenterRepository } from '../ports/renter.repository';

/** Los clientes de renta en memoria. */
export class InMemoryRenterRepository implements RenterRepository {
  readonly rows: Renter[] = [];
  private sequence = 0;

  list(query: RentersQuery): Promise<Renter[]> {
    const term = query.q?.toLowerCase();
    const rows = this.rows
      .filter((row) => query.blocked === undefined || row.isBlocked === query.blocked)
      .filter((row) => query.active === undefined || row.isActive === query.active)
      .filter(
        (row) =>
          term === undefined ||
          term === '' ||
          [row.fullName, row.documentId, row.licenseNumber, row.mobilePhone, row.phone].some(
            (value) => value?.toLowerCase().includes(term),
          ),
      )
      .sort((left, right) => left.fullName.localeCompare(right.fullName));

    return Promise.resolve(rows.map((row) => ({ ...row })));
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
