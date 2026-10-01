import { RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';

import { moveItem, rentalSettingsFormSchema, settingsFormValuesOf } from './settings-form';

const SETTINGS: RentalSettings = {
  ...RENTAL_SETTINGS_DEFAULTS,
  logoUrl: null,
  updatedAt: '2026-10-01T12:00:00.000Z',
};

describe('formulario de ajustes (095)', () => {
  it('los valores por defecto ida y vuelta pasan el schema', () => {
    const parsed = rentalSettingsFormSchema.parse(settingsFormValuesOf(SETTINGS));

    expect(parsed).toMatchObject({
      contractStartNumber: 733,
      vatRate: '0.00',
      graceHours: 1,
      defaultCdwPerDay: null,
    });
    expect(parsed.clauses).toHaveLength(17);
  });

  it('descarta cláusulas y accesorios en blanco', () => {
    const values = settingsFormValuesOf(SETTINGS);
    const parsed = rentalSettingsFormSchema.parse({
      ...values,
      accessories: ['Antena', '  ', 'Radio'],
      vatRate: '13',
    });

    expect(parsed.accessories).toEqual(['Antena', 'Radio']);
    expect(parsed.vatRate).toBe('13.00');
  });

  it('un número vacío no pasa', () => {
    const result = rentalSettingsFormSchema.safeParse({
      ...settingsFormValuesOf(SETTINGS),
      minDriverAge: '',
    });

    expect(result.success).toBe(false);
  });
});

describe('moveItem', () => {
  it('sube y baja', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('fuera de rango no cambia nada', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
