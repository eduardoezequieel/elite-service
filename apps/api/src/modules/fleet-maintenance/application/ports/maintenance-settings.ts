import type { MaintenanceAlerts } from '@elite/shared';

/** De los ajustes de la rentadora (095): los avisos y el nombre para el texto al taller. */
export interface MaintenanceSettings extends MaintenanceAlerts {
  companyName: string;
}

export interface MaintenanceSettingsSource {
  current(): Promise<MaintenanceSettings>;
}

export const MAINTENANCE_SETTINGS_SOURCE = Symbol('fleet-maintenance.MaintenanceSettingsSource');
