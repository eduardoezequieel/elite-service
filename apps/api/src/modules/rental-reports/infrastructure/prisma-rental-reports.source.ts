import { centsToMoney } from '@elite/shared';
import type { ReportVehicle } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { FleetVehicle as FleetVehicleRow, Prisma } from '@prisma/client';

import { decimalToCents } from '../../../common/prisma/decimal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toFleetVehicle } from '../../fleet/infrastructure/fleet-vehicle-row';
import type {
  ReportAgreementRecord,
  ReportPayment,
  RentalReportsSource,
  TodayAgreementRecord,
} from '../application/ports/rental-reports.source';

const agreementInclude = {
  customer: { select: { fullName: true } },
  payments: { select: { amount: true, voidedAt: true } },
  fines: { select: { amount: true, chargedToCustomer: true } },
} satisfies Prisma.RentalAgreementInclude;

type AgreementRow = Prisma.RentalAgreementGetPayload<{ include: typeof agreementInclude }>;

function money(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

const todayAgreementSelect = {
  id: true,
  contractNumber: true,
  vehicleId: true,
  status: true,
  plannedPickupAt: true,
  plannedReturnAt: true,
  customer: { select: { fullName: true, mobilePhone: true, phone: true } },
} satisfies Prisma.RentalAgreementSelect;

type TodayAgreementRow = Prisma.RentalAgreementGetPayload<{ select: typeof todayAgreementSelect }>;

function toReportVehicle(row: FleetVehicleRow): ReportVehicle {
  const vehicle = toFleetVehicle(row);

  return {
    id: vehicle.id,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    category: vehicle.category,
    status: vehicle.status,
    dailyRate: vehicle.dailyRate,
    odometerKm: vehicle.odometerKm,
    purchasePrice: vehicle.purchasePrice,
    purchasedAt: vehicle.purchasedAt,
    financed: vehicle.financed,
    downPayment: vehicle.downPayment,
    installment: vehicle.installment,
    termMonths: vehicle.termMonths,
    financingStartedAt: vehicle.financingStartedAt,
    installmentIncludesExtras: vehicle.installmentIncludesExtras,
    insuranceMonthly: vehicle.insuranceMonthly,
    gpsMonthly: vehicle.gpsMonthly,
    otherFixedMonthly: vehicle.otherFixedMonthly,
    insuranceExpiresAt: vehicle.insuranceExpiresAt,
    registrationExpiresAt: vehicle.registrationExpiresAt,
  };
}

function toAgreementRecord(row: AgreementRow): ReportAgreementRecord {
  const finesCharged = row.fines
    .filter((fine) => fine.chargedToCustomer)
    .reduce((sum, fine) => sum + decimalToCents(fine.amount), 0);

  return {
    id: row.id,
    contractNumber: row.contractNumber,
    vehicleId: row.vehicleId,
    status: row.status,
    customerName: row.customer.fullName,
    plannedPickupAt: row.plannedPickupAt.toISOString(),
    plannedReturnAt: row.plannedReturnAt.toISOString(),
    actualPickupAt: row.actualPickupAt?.toISOString() ?? null,
    actualReturnAt: row.actualReturnAt?.toISOString() ?? null,
    pickupLocation: row.pickupLocation,
    returnLocation: row.returnLocation,
    includesVat: row.includesVat,
    totals: {
      dailyRate: money(row.dailyRate),
      cdwPerDay: money(row.cdwPerDay),
      billableDays: row.billableDays,
      extraCharges: money(row.extraCharges),
      extraKmCharge: money(row.extraKmCharge),
      finesCharged: centsToMoney(finesCharged),
      discount: money(row.discount),
      payments: row.payments.map((payment) => ({
        amount: money(payment.amount),
        voidedAt: payment.voidedAt,
      })),
    },
  };
}

/** Lee la flota, las rentas y los pagos directo, sin los módulos de la 095–099. */
@Injectable()
export class PrismaRentalReportsSource implements RentalReportsSource {
  constructor(private readonly prisma: PrismaService) {}

  async vehicles(): Promise<ReportVehicle[]> {
    const rows = await this.prisma.fleetVehicle.findMany({ orderBy: { createdAt: 'asc' } });

    return rows.map(toReportVehicle);
  }

  async vehicle(id: string): Promise<ReportVehicle | null> {
    const row = await this.prisma.fleetVehicle.findUnique({ where: { id } });

    return row === null ? null : toReportVehicle(row);
  }

  async agreements(vehicleId?: string): Promise<ReportAgreementRecord[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: { status: { not: 'CANCELLED' }, ...(vehicleId === undefined ? {} : { vehicleId }) },
      include: agreementInclude,
      orderBy: { plannedPickupAt: 'asc' },
    });

    return rows.map(toAgreementRecord);
  }

  async todayAgreements(): Promise<TodayAgreementRecord[]> {
    const rows = await this.prisma.rentalAgreement.findMany({
      where: { status: { in: ['RESERVED', 'IN_PROGRESS'] } },
      select: todayAgreementSelect,
      orderBy: { plannedPickupAt: 'asc' },
    });

    return rows.map(toTodayAgreement);
  }

  async payments(): Promise<ReportPayment[]> {
    const rows = await this.prisma.rentalPayment.findMany({
      select: { amount: true, method: true, paidAt: true, voidedAt: true },
    });

    return rows.map((row) => ({
      amount: money(row.amount),
      method: row.method,
      paidAt: row.paidAt.toISOString(),
      voidedAt: row.voidedAt?.toISOString() ?? null,
    }));
  }
}

function toTodayAgreement(row: TodayAgreementRow): TodayAgreementRecord {
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    vehicleId: row.vehicleId,
    status: row.status,
    customerName: row.customer.fullName,
    customerPhone: row.customer.mobilePhone ?? row.customer.phone ?? '',
    plannedPickupAt: row.plannedPickupAt.toISOString(),
    plannedReturnAt: row.plannedReturnAt.toISOString(),
  };
}
