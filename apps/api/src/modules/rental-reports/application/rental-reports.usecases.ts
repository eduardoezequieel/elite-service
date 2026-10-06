import {
  API_ERROR_CODES,
  addCivilDays,
  agreementIncome,
  civilDateOfInstant,
  civilStartMs,
  profitabilityReport,
  vehicleMonths,
} from '@elite/shared';
import type {
  MonthsQuery,
  ProfitabilityQuery,
  ProfitabilityReport,
  RentalToday,
  ReportAgreement,
  ReportExpense,
  VehicleMonths,
} from '@elite/shared';

import { NotFoundError } from '../../../common/errors/application-error';
import { slicePage } from '../../../common/pagination/page';
import type { FleetExpensesReader } from '../../fleet-maintenance/application/ports/fleet-expenses-reader';
import { buildRentalToday } from '../domain/rental-today';
import type {
  ReportAgreementRecord,
  RentalReportsSource,
  ReportSettingsSource,
} from './ports/rental-reports.source';

/**
 * Hoy (107) y la rentabilidad (100). Solo junta datos: el estado del carro y
 * las listas del día son puros, y las cuentas de rentabilidad viven en
 * `rentals/reports.ts` de shared.
 */
export class RentalReportsUseCases {
  constructor(
    private readonly source: RentalReportsSource,
    private readonly expenses: FleetExpensesReader,
    private readonly settings: ReportSettingsSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async today(): Promise<RentalToday> {
    const now = this.now();
    const day = civilDateOfInstant(now);
    const from = new Date(civilStartMs(day));
    const to = new Date(civilStartMs(addCivilDays(day, 1)));
    const [vehicles, agreements, payments] = await Promise.all([
      this.source.vehicles(),
      this.source.todayAgreements(),
      this.source.paymentsBetween(from, to),
    ]);

    return buildRentalToday({ vehicles, agreements, payments, now });
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
