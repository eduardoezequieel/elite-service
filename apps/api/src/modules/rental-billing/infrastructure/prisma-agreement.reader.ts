import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type {
  AgreementReader,
  AgreementSpan,
  BillingAgreementRecord,
} from '../application/ports/agreement-reader';
import { agreementInclude, toAgreementRecord } from './billing-rows';

/** Lee `rental_agreements` directo, sin el módulo de rentas (098 corre junto a la 096). */
@Injectable()
export class PrismaAgreementReader implements AgreementReader {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<BillingAgreementRecord | null> {
    const row = await this.prisma.rentalAgreement.findUnique({
      where: { id },
      include: agreementInclude,
    });

    return row === null ? null : toAgreementRecord(row);
  }

  async listHoldingVehicle(vehicleId: string): Promise<AgreementSpan[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: { vehicleId, status: { in: ['IN_PROGRESS', 'FINISHED'] } },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        vehicleId: true,
        plannedPickupAt: true,
        plannedReturnAt: true,
        actualPickupAt: true,
        actualReturnAt: true,
        customer: { select: { fullName: true } },
      },
    });

    return rows.map(({ customer, ...row }) => ({ ...row, customerName: customer.fullName }));
  }

  async listOpenAccounts(): Promise<BillingAgreementRecord[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: {
        OR: [
          { status: { in: ['IN_PROGRESS', 'FINISHED'] } },
          { deposit: { gt: 0 }, depositReturnedAmount: null, depositTransferredToId: null },
        ],
      },
      include: agreementInclude,
      orderBy: { plannedPickupAt: 'asc' },
    });

    return rows.map(toAgreementRecord);
  }
}
