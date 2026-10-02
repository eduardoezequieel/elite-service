import {
  API_ERROR_CODES,
  agreementIncome,
  civilDateOfInstant,
  profitabilityReport,
  rentalDashboard,
  vehicleMonths,
} from '@elite/shared';
import type {
  MonthsQuery,
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalDashboard,
  ReportAgreement,
  ReportExpense,
  VehicleMonths,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import { slicePage } from '../../../common/pagination/page';
import type { FleetExpensesReader } from '../../fleet-maintenance/application/ports/fleet-expenses-reader';
import type {
  ReportAgreementRecord,
  RentalReportsSource,
  ReportSettingsSource,
} from './ports/rental-reports.source';

/**
 * El inicio de la rentadora y la rentabilidad (100). Solo junta datos: toda
 * cuenta es pura y vive en `rentals/reports.ts` de shared (RN-6).
 */
export class RentalReportsUseCases {
  constructor(
    private readonly source: RentalReportsSource,
    private readonly expenses: FleetExpensesReader,
    private readonly settings: ReportSettingsSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dashboard(): Promise<RentalDashboard> {
    const [vehicles, records, maintenance, settings] = await Promise.all([
      this.source.vehicles(),
      this.source.agreements(),
      this.source.maintenance(),
      this.settings.current(),
    ]);

    return rentalDashboard({
      vehicles,
      agreements: withIncome(records, settings.vatRate),
      plan: maintenance.plan,
      lastServices: maintenance.lastServices,
      alerts: { kmAlert: settings.kmAlert, daysAlert: settings.daysAlert },
      now: this.now(),
    });
  }

  async profitability(query: ProfitabilityQuery): Promise<ProfitabilityReport> {
    const [vehicles, records, settings] = await Promise.all([
      this.source.vehicles(),
      this.source.agreements(),
      this.settings.current(),
    ]);
    // Todos los gastos de cada carro: el inicio del carro y lo recuperado
    // miran la historia entera, no solo el periodo.
    const expenses = new Map<string, ReportExpense[]>(
      await Promise.all(
        vehicles.map(async (vehicle) => [vehicle.id, await this.expensesOf(vehicle.id)] as const),
      ),
    );

    const report = profitabilityReport(
      vehicles,
      withIncome(records, settings.vatRate),
      expenses,
      query.from,
      query.to,
      this.now(),
    );

    // Las cuentas son de toda la flota; solo las filas salen de a una página (101).
    return { ...report, rows: slicePage(report.rows, query) };
  }

  async months(vehicleId: string, query: MonthsQuery): Promise<VehicleMonths> {
    const vehicle = await this.source.vehicle(vehicleId);

    if (vehicle === null) {
      throw new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese carro no existe.' });
    }

    const now = this.now();
    const [records, expenses, settings] = await Promise.all([
      this.source.agreements(vehicleId),
      this.expensesOf(vehicleId),
      this.settings.current(),
    ]);
    const year = query.year ?? Number(civilDateOfInstant(now).slice(0, 4));

    return vehicleMonths(vehicle, withIncome(records, settings.vatRate), expenses, year, now);
  }

  private async expensesOf(vehicleId: string): Promise<ReportExpense[]> {
    const rows = await this.expenses.listByVehicle(vehicleId);

    return rows.map((row) => ({ incurredAt: row.incurredAt, amount: row.amount }));
  }
}

/** RN-1: ingreso neto y saldo de cada renta, con el IVA de ajustes. */
function withIncome(records: readonly ReportAgreementRecord[], vatRate: string): ReportAgreement[] {
  return records.map(({ totals, includesVat, ...agreement }) => ({
    ...agreement,
    ...agreementIncome({ ...totals, includesVat }, vatRate),
  }));
}
