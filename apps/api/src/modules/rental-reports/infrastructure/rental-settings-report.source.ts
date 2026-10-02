import type { RentalSettingsUseCases } from '../../rental-settings/application/rental-settings.usecases';
import type {
  ReportSettings,
  ReportSettingsSource,
} from '../application/ports/rental-reports.source';

/**
 * El IVA y los avisos salen de los ajustes de la rentadora (095), por el caso
 * de uso que exporta `RentalSettingsModule`.
 */
export class RentalSettingsReportSource implements ReportSettingsSource {
  constructor(private readonly settings: RentalSettingsUseCases) {}

  async current(): Promise<ReportSettings> {
    const { vatRate, kmAlert, daysAlert } = await this.settings.current();

    return { vatRate, kmAlert, daysAlert };
  }
}
