import type { RentalSettings, RentalSettingsInput } from '@elite/shared';

/**
 * Puerto de la fila única de ajustes de la rentadora (095 RN-8).
 */
export interface RentalSettingsRepository {
  /** La fila; si no existe la crea con `defaults` (sin pisar una que ganó la carrera). */
  getOrCreate(defaults: RentalSettingsInput): Promise<RentalSettings>;
  /** Reemplaza la fila entera; si no existía, la crea. */
  save(input: RentalSettingsInput): Promise<RentalSettings>;
}

/** ¿Existe ese archivo y es un logo? Lo implementa el módulo de archivos sobre la misma base. */
export interface LogoFileLookup {
  isLogo(fileId: string): Promise<boolean>;
}

export const RENTAL_SETTINGS_REPOSITORY = Symbol('rental-settings.RentalSettingsRepository');
export const LOGO_FILE_LOOKUP = Symbol('rental-settings.LogoFileLookup');
