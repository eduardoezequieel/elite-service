import type { RentalSettingsUseCases } from '../../rental-settings/application/rental-settings.usecases';
import type {
  MaintenanceSettings,
  MaintenanceSettingsSource,
} from '../application/ports/maintenance-settings';

/**
 * Los avisos de km y días salen de los ajustes de la rentadora (095), por el
 * caso de uso que exporta `RentalSettingsModule`: el permiso ya lo pidió el
 * endpoint de mantenimiento.
 */
export class RentalSettingsMaintenanceSource implements MaintenanceSettingsSource {
  constructor(private readonly settings: RentalSettingsUseCases) {}

  async current(): Promise<MaintenanceSettings> {
    const { kmAlert, daysAlert, companyName } = await this.settings.current();

    return { kmAlert, daysAlert, companyName };
  }
}
