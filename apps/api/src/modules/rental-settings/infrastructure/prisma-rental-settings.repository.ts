import { rentalLogoUrl } from '@elite/shared';
import type { RentalSettings, RentalSettingsInput } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { RentalSettings as RentalSettingsRow } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { RentalSettingsRepository } from '../application/ports/rental-settings.repository';

/** La única fila (RN-8). */
const KEY = 'default';

/** Las columnas `Json` guardan `string[]`; lo que no sea texto se descarta. */
function textList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function toRentalSettings(row: RentalSettingsRow): RentalSettings {
  return {
    companyName: row.companyName,
    taxId: row.taxId,
    nrc: row.nrc,
    address: row.address,
    phones: row.phones,
    email: row.email,
    lessorName: row.lessorName,
    city: row.city,
    contractStartNumber: row.contractStartNumber,
    vatRate: row.vatRate.toFixed(2),
    defaultCdwPerDay: row.defaultCdwPerDay?.toFixed(2) ?? null,
    defaultDeductible: row.defaultDeductible?.toFixed(2) ?? null,
    bufferHours: row.bufferHours,
    graceHours: row.graceHours,
    minDriverAge: row.minDriverAge,
    kmAlert: row.kmAlert,
    daysAlert: row.daysAlert,
    interestRate: row.interestRate?.toFixed(2) ?? null,
    lateInterestRate: row.lateInterestRate?.toFixed(2) ?? null,
    contractIntro: row.contractIntro,
    clauses: textList(row.clauses),
    accessories: textList(row.accessories),
    logoFileId: row.logoFileId,
    logoUrl: rentalLogoUrl(row.logoFileId),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaRentalSettingsRepository implements RentalSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(defaults: RentalSettingsInput): Promise<RentalSettings> {
    // `update: {}`: si otra lectura la creó primero, se respeta la suya.
    const row = await this.prisma.rentalSettings.upsert({
      where: { key: KEY },
      update: {},
      create: { key: KEY, ...defaults },
    });

    return toRentalSettings(row);
  }

  async save(input: RentalSettingsInput): Promise<RentalSettings> {
    const row = await this.prisma.rentalSettings.upsert({
      where: { key: KEY },
      update: input,
      create: { key: KEY, ...input },
    });

    return toRentalSettings(row);
  }
}
