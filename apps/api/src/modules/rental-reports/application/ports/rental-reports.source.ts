import type {
  AgreementTotalsInput,
  DashboardLastService,
  DashboardPlanTask,
  ReportAgreement,
  ReportVehicle,
} from '@elite/shared';

/**
 * Una renta tal como sale de la base, con lo que entra a `agreementTotals`. El
 * caso de uso le calcula el ingreso y el saldo (RN-1) con el IVA de ajustes.
 */
export type ReportAgreementRecord = Omit<ReportAgreement, 'income' | 'balance'> & {
  totals: AgreementTotalsInput;
  includesVat: boolean;
};

/**
 * Lectura directa de `fleet_vehicles`, `rental_agreements` (con pagos y
 * multas) y del plan de mantenimiento (099) para los reportes (100). No pasa
 * por los módulos de flota, rentas ni cobros.
 */
export interface RentalReportsSource {
  /** Todos los carros, también los retirados. */
  vehicles(): Promise<ReportVehicle[]>;
  vehicle(id: string): Promise<ReportVehicle | null>;
  /** Las rentas no canceladas; con `vehicleId`, solo las de ese carro. */
  agreements(vehicleId?: string): Promise<ReportAgreementRecord[]>;
  /** Las tareas activas del plan y el último servicio por carro y tarea. */
  maintenance(): Promise<{ plan: DashboardPlanTask[]; lastServices: DashboardLastService[] }>;
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
