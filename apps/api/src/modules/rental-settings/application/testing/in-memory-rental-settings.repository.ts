import { rentalLogoUrl } from '@elite/shared';
import type { RentalSettings, RentalSettingsInput } from '@elite/shared';

import type { LogoFileLookup, RentalSettingsRepository } from '../ports/rental-settings.repository';

/** La fila única de ajustes, en memoria. */
export class InMemoryRentalSettingsRepository implements RentalSettingsRepository {
  row: RentalSettings | null = null;
  creations = 0;

  getOrCreate(defaults: RentalSettingsInput): Promise<RentalSettings> {
    if (this.row === null) {
      this.creations += 1;
      this.row = this.toRow(defaults);
    }

    return Promise.resolve(structuredClone(this.row));
  }

  save(input: RentalSettingsInput): Promise<RentalSettings> {
    this.row = this.toRow(input);

    return Promise.resolve(structuredClone(this.row));
  }

  private toRow(input: RentalSettingsInput): RentalSettings {
    return {
      ...structuredClone(input),
      logoUrl: rentalLogoUrl(input.logoFileId),
      updatedAt: new Date(Date.UTC(2026, 9, 1, 12)).toISOString(),
    };
  }
}

/** Los logos que existen, por id. */
export class InMemoryLogoFileLookup implements LogoFileLookup {
  readonly ids = new Set<string>();

  isLogo(fileId: string): Promise<boolean> {
    return Promise.resolve(this.ids.has(fileId));
  }
}
