import type {
  DashboardLastService,
  DashboardPlanTask,
  FleetExpenseRow,
  ReportVehicle,
} from '@elite/shared';

import type { FleetExpensesReader } from '../../../fleet-maintenance/application/ports/fleet-expenses-reader';
import type {
  ReportAgreementRecord,
  RentalReportsSource,
  ReportSettings,
  ReportSettingsSource,
} from '../ports/rental-reports.source';

/** Un carro en memoria: lo que no se pasa, vacío. */
export function reportVehicle(overrides: Partial<ReportVehicle> & { id: string }): ReportVehicle {
  return {
    plate: null,
    make: 'Toyota',
    model: 'Yaris',
    year: 2022,
    category: 'SEDAN',
    status: 'ACTIVE',
    dailyRate: '35.00',
    odometerKm: 0,
    purchasePrice: null,
    purchasedAt: null,
    financed: false,
    downPayment: null,
    installment: null,
    termMonths: null,
    financingStartedAt: null,
    installmentIncludesExtras: false,
    insuranceMonthly: null,
    gpsMonthly: null,
    otherFixedMonthly: null,
    insuranceExpiresAt: null,
    registrationExpiresAt: null,
    ...overrides,
  };
}

/** Una renta en memoria; el total sale de `dailyRate × billableDays`. */
export function reportAgreement(
  overrides: Partial<ReportAgreementRecord> & { id: string; vehicleId: string },
): ReportAgreementRecord {
  return {
    contractNumber: null,
    status: 'FINISHED',
    customerName: 'Ana Pérez',
    plannedPickupAt: '2026-10-01T16:00:00.000Z',
    plannedReturnAt: '2026-10-03T16:00:00.000Z',
    actualPickupAt: '2026-10-01T16:00:00.000Z',
    actualReturnAt: '2026-10-03T16:00:00.000Z',
    pickupLocation: 'Oficina',
    returnLocation: 'Oficina',
    includesVat: false,
    totals: {
      dailyRate: '50.00',
      cdwPerDay: '0.00',
      billableDays: 2,
      extraCharges: '0.00',
      extraKmCharge: '0.00',
      finesCharged: '0.00',
      discount: '0.00',
      payments: [],
    },
    ...overrides,
  };
}

export class InMemoryRentalReports
  implements RentalReportsSource, FleetExpensesReader, ReportSettingsSource
{
  readonly vehicleRows: ReportVehicle[] = [];
  readonly agreementRows: ReportAgreementRecord[] = [];
  readonly expenseRows: { vehicleId: string; incurredAt: string; amount: string }[] = [];
  readonly plan: DashboardPlanTask[] = [];
  readonly lastServices: DashboardLastService[] = [];
  settings: ReportSettings = { vatRate: '0.00', kmAlert: 500, daysAlert: 7 };

  vehicles(): Promise<ReportVehicle[]> {
    return Promise.resolve([...this.vehicleRows]);
  }

  vehicle(id: string): Promise<ReportVehicle | null> {
    return Promise.resolve(this.vehicleRows.find((vehicle) => vehicle.id === id) ?? null);
  }

  agreements(vehicleId?: string): Promise<ReportAgreementRecord[]> {
    return Promise.resolve(
      this.agreementRows.filter(
        (agreement) =>
          agreement.status !== 'CANCELLED' &&
          (vehicleId === undefined || agreement.vehicleId === vehicleId),
      ),
    );
  }

  maintenance(): Promise<{ plan: DashboardPlanTask[]; lastServices: DashboardLastService[] }> {
    return Promise.resolve({ plan: [...this.plan], lastServices: [...this.lastServices] });
  }

  listByVehicle(vehicleId: string, from?: string, to?: string): Promise<FleetExpenseRow[]> {
    return Promise.resolve(
      this.expenseRows
        .filter(
          (expense) =>
            expense.vehicleId === vehicleId &&
            (from === undefined || expense.incurredAt >= from) &&
            (to === undefined || expense.incurredAt <= to),
        )
        .map((expense, index) => ({
          id: `expense-${index}`,
          source: 'MANUAL' as const,
          vehicle: { id: vehicleId, plate: null, make: 'Toyota', model: 'Yaris', year: null },
          type: 'OTHER' as const,
          amount: expense.amount,
          incurredAt: expense.incurredAt,
          odometerKm: null,
          description: null,
          maintenanceLogId: null,
          reference: null,
          editable: true,
        })),
    );
  }

  async sumByVehicle(vehicleId: string, from?: string, to?: string): Promise<string> {
    const rows = await this.listByVehicle(vehicleId, from, to);
    const cents = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);

    return (cents / 100).toFixed(2);
  }

  current(): Promise<ReportSettings> {
    return Promise.resolve(this.settings);
  }
}
