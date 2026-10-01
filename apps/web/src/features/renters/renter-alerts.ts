import type { Renter } from '@elite/shared';

/**
 * Lo que la ficha de un cliente avisa antes de rentarle (095): licencia
 * vencida y menor de la edad mínima de los ajustes. Puro: recibe el día de hoy.
 */
export interface RenterAlert {
  key: 'blocked' | 'license-expired' | 'underage' | 'inactive';
  message: string;
}

/** Años cumplidos a `today` de alguien nacido en `birthDate` (civiles `YYYY-MM-DD`). */
export function ageOn(birthDate: string, today: string): number {
  const [birthYear = 0, birthMonth = 0, birthDay = 0] = birthDate.split('-').map(Number);
  const [year = 0, month = 0, day = 0] = today.split('-').map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);

  return year - birthYear - (hadBirthday ? 0 : 1);
}

export function renterAlerts(
  renter: Pick<Renter, 'isBlocked' | 'blockReason' | 'isActive' | 'licenseExpiresAt' | 'birthDate'>,
  today: string,
  minDriverAge: number,
): RenterAlert[] {
  const alerts: RenterAlert[] = [];

  if (renter.isBlocked) {
    alerts.push({
      key: 'blocked',
      message: renter.blockReason ? `No rentar: ${renter.blockReason}` : 'No rentar.',
    });
  }
  if (!renter.isActive) alerts.push({ key: 'inactive', message: 'Cliente inactivo.' });
  if (renter.licenseExpiresAt !== null && renter.licenseExpiresAt < today) {
    alerts.push({ key: 'license-expired', message: 'La licencia está vencida.' });
  }
  if (renter.birthDate !== null && ageOn(renter.birthDate, today) < minDriverAge) {
    alerts.push({
      key: 'underage',
      message: `Tiene ${ageOn(renter.birthDate, today)} años: la edad mínima es ${minDriverAge}.`,
    });
  }

  return alerts;
}
