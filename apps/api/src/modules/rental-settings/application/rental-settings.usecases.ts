import { API_ERROR_CODES, PERMISSIONS, RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import type { RentalSettings, RentalSettingsInput } from '@elite/shared';

import { ForbiddenError, ValidationError } from '../../../common/errors/application-error';
import type { LogoFileLookup, RentalSettingsRepository } from './ports/rental-settings.repository';

/**
 * Leer los ajustes alcanza con cualquiera de estas: el contrato y la flota los
 * necesitan para calcular (días de gracia, IVA, alertas), no solo quien los edita.
 */
const READERS = [
  PERMISSIONS.rentals.actions.read.key,
  PERMISSIONS.rentals.actions.settings.key,
  PERMISSIONS.fleet.actions.read.key,
];

/**
 * Los ajustes de la rentadora (095): una sola fila (RN-8). La primera lectura
 * la crea con los valores del prototipo.
 */
export class RentalSettingsUseCases {
  constructor(
    private readonly settings: RentalSettingsRepository,
    private readonly logos: LogoFileLookup,
  ) {}

  /**
   * Es un «o» entre tres claves, que el guard global no expresa: por eso se
   * decide acá, siempre por clave y nunca por rol.
   */
  async get(permissions: readonly string[]): Promise<RentalSettings> {
    if (!READERS.some((key) => permissions.includes(key))) {
      throw new ForbiddenError({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'No tenés permiso para hacer esto.',
      });
    }

    return this.current();
  }

  /**
   * Los ajustes vigentes, sin mirar permisos: para otro caso de uso que ya
   * autorizó su propia acción (las rentas leen las horas de gracia, 096).
   */
  current(): Promise<RentalSettings> {
    return this.settings.getOrCreate(RENTAL_SETTINGS_DEFAULTS);
  }

  async update(input: RentalSettingsInput): Promise<RentalSettings> {
    if (input.logoFileId !== null && !(await this.logos.isLogo(input.logoFileId))) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese logo no existe. Subilo de nuevo.',
        details: { logoFileId: 'Ese logo no existe. Subilo de nuevo.' },
      });
    }

    return this.settings.save(input);
  }
}
