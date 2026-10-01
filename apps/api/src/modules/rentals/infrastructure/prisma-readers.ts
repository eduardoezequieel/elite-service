import { RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import type {
  FleetVehicleCategory,
  FleetVehicleStatus,
  RentalAgreementVehicle,
} from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { uniqueViolationOn } from '../../../common/prisma/unique-violation';
import type {
  Clock,
  ContractNumberSequence,
  FleetVehicleReader,
  RentalSettingsReader,
  RentalTerms,
  RenterReader,
  RenterSummary,
} from '../application/ports/readers';
import { nextContractNumber } from '../domain/agreement';
import { toAgreementVehicle } from './agreement-row';

/**
 * Lo que las rentas leen de las tablas de la 095, directo con Prisma: la spec
 * pide no importar los módulos de flota, clientes ni ajustes.
 */

@Injectable()
export class PrismaFleetVehicleReader implements FleetVehicleReader {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RentalAgreementVehicle | null> {
    const row = await this.prisma.fleetVehicle.findUnique({ where: { id } });

    return row === null ? null : toAgreementVehicle(row);
  }

  async list(filter: {
    statuses: readonly FleetVehicleStatus[];
    category?: FleetVehicleCategory;
  }): Promise<RentalAgreementVehicle[]> {
    const rows = await this.prisma.fleetVehicle.findMany({
      where: {
        status: { in: [...filter.statuses] },
        ...(filter.category === undefined ? {} : { category: filter.category }),
      },
      orderBy: [{ make: 'asc' }, { model: 'asc' }, { plate: 'asc' }],
    });

    return rows.map(toAgreementVehicle);
  }
}

@Injectable()
export class PrismaRenterReader implements RenterReader {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<RenterSummary | null> {
    return this.prisma.rentalCustomer.findUnique({
      where: { id },
      select: { id: true, fullName: true, isBlocked: true, blockReason: true },
    });
  }
}

/**
 * Los ajustes vigentes. Si la fila todavía no existe (nadie abrió Ajustes),
 * valen los mismos valores con que nacería: no se crea desde acá.
 */
@Injectable()
export class PrismaRentalSettingsReader implements RentalSettingsReader {
  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<RentalTerms> {
    const row = await this.prisma.rentalSettings.findUnique({
      where: { key: 'default' },
      select: {
        bufferHours: true,
        graceHours: true,
        defaultCdwPerDay: true,
        defaultDeductible: true,
        contractStartNumber: true,
      },
    });

    if (row === null) {
      return {
        bufferHours: RENTAL_SETTINGS_DEFAULTS.bufferHours,
        graceHours: RENTAL_SETTINGS_DEFAULTS.graceHours,
        defaultCdwPerDay: RENTAL_SETTINGS_DEFAULTS.defaultCdwPerDay,
        defaultDeductible: RENTAL_SETTINGS_DEFAULTS.defaultDeductible,
        contractStartNumber: RENTAL_SETTINGS_DEFAULTS.contractStartNumber,
      };
    }

    return {
      bufferHours: row.bufferHours,
      graceHours: row.graceHours,
      defaultCdwPerDay: row.defaultCdwPerDay?.toFixed(2) ?? null,
      defaultDeductible: row.defaultDeductible?.toFixed(2) ?? null,
      contractStartNumber: row.contractStartNumber,
    };
  }
}

/** Cuántas veces se reintenta si otra entrega tomó el mismo número (RN-3). */
const CONTRACT_NUMBER_ATTEMPTS = 3;

/**
 * RN-3: `max(contractNumber) + 1`, nunca menor que el inicial. El único de la
 * columna frena dos entregas simultáneas; la que pierde vuelve a leer el
 * máximo y prueba con el siguiente (el mismo patrón que `retryOnSequenceClash`,
 * acá sobre una columna entera).
 */
@Injectable()
export class PrismaContractNumberSequence implements ContractNumberSequence {
  constructor(private readonly prisma: PrismaService) {}

  async assign(agreementId: string, startNumber: number): Promise<number> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ contractNumber: number | null }[]>`
            SELECT "contractNumber" FROM rental_agreements
            WHERE id = ${agreementId}::uuid FOR UPDATE
          `;
          const current = rows[0]?.contractNumber ?? null;

          if (current !== null) return current;

          const max = await tx.rentalAgreement.aggregate({ _max: { contractNumber: true } });
          const next = nextContractNumber(max._max.contractNumber, startNumber);

          await tx.rentalAgreement.update({
            where: { id: agreementId },
            data: { contractNumber: next },
          });

          return next;
        });
      } catch (error) {
        if (attempt < CONTRACT_NUMBER_ATTEMPTS && uniqueViolationOn(error, 'contractNumber')) {
          continue;
        }
        throw error;
      }
    }
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
