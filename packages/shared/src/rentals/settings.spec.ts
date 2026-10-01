import { RENTAL_SETTINGS_DEFAULTS, percentSchema, rentalSettingsSchema } from './settings';

describe('RENTAL_SETTINGS_DEFAULTS (095)', () => {
  it('trae los valores del prototipo', () => {
    expect(RENTAL_SETTINGS_DEFAULTS).toMatchObject({
      companyName: "RIVERA'S RENT A CARS",
      taxId: '0614-070624-103-3',
      lessorName: 'JOSUE ALEXANDER RIVERA',
      contractStartNumber: 733,
      vatRate: '0.00',
      bufferHours: 1,
      minDriverAge: 21,
    });
    expect(RENTAL_SETTINGS_DEFAULTS.clauses).toHaveLength(17);
    expect(RENTAL_SETTINGS_DEFAULTS.accessories).toHaveLength(28);
    expect(RENTAL_SETTINGS_DEFAULTS.contractIntro).toContain('{ARRENDANTE}');
  });

  it('pasa su propio schema', () => {
    expect(rentalSettingsSchema.safeParse(RENTAL_SETTINGS_DEFAULTS).success).toBe(true);
  });
});

describe('percentSchema', () => {
  it('normaliza a dos decimales', () => {
    expect(percentSchema.parse(13)).toBe('13.00');
    expect(percentSchema.parse('7.5')).toBe('7.50');
  });

  it('no pasa de 100', () => {
    expect(percentSchema.safeParse('100.01').success).toBe(false);
    expect(percentSchema.safeParse('abc').success).toBe(false);
  });
});
