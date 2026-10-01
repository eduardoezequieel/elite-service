import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { BillingFineRecord } from '../application/ports/agreement-reader';
import type {
  FineFilter,
  NewRentalFine,
  RentalFineRepository,
} from '../application/ports/rental-fine.repository';
import { fineInclude, toFineRecord } from './billing-rows';

@Injectable()
export class PrismaRentalFineRepository implements RentalFineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async vehicleExists(vehicleId: string): Promise<boolean> {
    return (await this.prisma.fleetVehicle.count({ where: { id: vehicleId } })) > 0;
  }

  async create(fine: NewRentalFine): Promise<BillingFineRecord> {
    const row = await this.prisma.rentalFine.create({ data: fine, include: fineInclude });

    return toFineRecord(row);
  }

  async list(filter: FineFilter): Promise<BillingFineRecord[]> {
    const rows = await this.prisma.rentalFine.findMany({
      where: {
        ...(filter.vehicleId === undefined ? {} : { vehicleId: filter.vehicleId }),
        ...(filter.agreementId === undefined ? {} : { agreementId: filter.agreementId }),
        ...(filter.from === undefined && filter.to === undefined
          ? {}
          : {
              occurredAt: {
                ...(filter.from === undefined ? {} : { gte: filter.from }),
                ...(filter.to === undefined ? {} : { lt: filter.to }),
              },
            }),
      },
      include: fineInclude,
      orderBy: { occurredAt: 'desc' },
    });

    return rows.map(toFineRecord);
  }
}
