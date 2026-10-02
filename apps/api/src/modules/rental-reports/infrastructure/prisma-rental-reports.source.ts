import { centsToMoney } from '@elite/shared';
import type { DashboardLastService, DashboardPlanTask, ReportVehicle } from '@elite/shared';
import { Injectable } from '@nestjs/common';
import type { FleetVehicle as FleetVehicleRow, Prisma } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';
import { decimalToCents } from '../../../common/prisma/decimal';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { toFleetVehicle } from '../../fleet/infrastructure/fleet-vehicle-row';
import type {
  ReportAgreementRecord,
  RentalReportsSource,
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

/** Lee la flota, las rentas y el plan directo, sin los módulos de la 095–099. */
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

  async maintenance(): Promise<{
    plan: DashboardPlanTask[];
    lastServices: DashboardLastService[];
  }> {
    const [plan, logs] = await Promise.all([
      this.prisma.maintenancePlanTask.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, intervalKm: true, intervalDays: true },
      }),
      // `distinct` con este orden deja la fila más reciente de cada carro × tarea.
      this.prisma.maintenanceLog.findMany({
        where: { taskId: { not: null } },
        distinct: ['vehicleId', 'taskId'],
        orderBy: [
          { vehicleId: 'asc' },
          { taskId: 'asc' },
          { performedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: { vehicleId: true, taskId: true, performedAt: true, odometerKm: true },
      }),
    ]);

    return {
      plan,
      lastServices: logs.flatMap((log) => {
        const performedAt = dateToCivil(log.performedAt);
        return log.taskId === null || performedAt === null
          ? []
          : [
              {
                vehicleId: log.vehicleId,
                taskId: log.taskId,
                performedAt,
                odometerKm: log.odometerKm,
              },
            ];
      }),
    };
  }
}
