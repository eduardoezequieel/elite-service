import type { AgreementTotalsInput, ReportAgreement, ReportVehicle } from '@elite/shared';

import type { ReportPayment, TodayAgreementRecord } from '../../domain/rental-today';

/**
 * Una renta tal como sale de la base, con lo que entra a `agreementTotals`. El
 * caso de uso le calcula el ingreso y el saldo (RN-1) con el IVA de ajustes.
 */
export type ReportAgreementRecord = Omit<ReportAgreement, 'income' | 'balance'> & {
  totals: AgreementTotalsInput;
  includesVat: boolean;
};

/**
 * Lectura directa de `fleet_vehicles`, `rental_agreements` y `rental_payments`
 * para Hoy (107) y la rentabilidad (100). No pasa por los módulos de flota,
 * rentas ni cobros.
 */
export interface RentalReportsSource {
  /** Todos los carros, también los retirados. */
  vehicles(): Promise<ReportVehicle[]>;
  vehicle(id: string): Promise<ReportVehicle | null>;
  /** Las rentas no canceladas; con `vehicleId`, solo las de ese carro. */
  agreements(vehicleId?: string): Promise<ReportAgreementRecord[]>;
  /** Rentas reservadas o en curso: las únicas que Hoy puede listar. */
  todayAgreements(): Promise<TodayAgreementRecord[]>;
  /**
   * Pagos de renta con `paidAt` en `[from, to)`, anulados incluidos.
   * Hoy pide el día civil y descarta los anulados.
   */
  paymentsBetween(from: Date, to: Date): Promise<ReportPayment[]>;
}

export const RENTAL_REPORTS_SOURCE = Symbol('rental-reports.RentalReportsSource');

/** Lo que los reportes leen de los ajustes de la rentadora (095). */
export interface ReportSettings {
  vatRate: string;
  kmAlert: number;
  daysAlert: number;
}

export interface ReportSettingsSource {
  current(): Promise<ReportSettings>;
}

export const REPORT_SETTINGS_SOURCE = Symbol('rental-reports.ReportSettingsSource');

export type { ReportPayment, TodayAgreementRecord };
