import { API_ERROR_CODES, PERMISSIONS, RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { RentalSettingsUseCases } from './rental-settings.usecases';
import {
  InMemoryLogoFileLookup,
  InMemoryRentalSettingsRepository,
} from './testing/in-memory-rental-settings.repository';

const SETTINGS = PERMISSIONS.rentals.actions.settings.key;
const LOGO = '00000000-0000-4000-8000-000000000001';

describe('RentalSettingsUseCases (095)', () => {
  let repo: InMemoryRentalSettingsRepository;
  let logos: InMemoryLogoFileLookup;
  let settings: RentalSettingsUseCases;

  beforeEach(() => {
    repo = new InMemoryRentalSettingsRepository();
    logos = new InMemoryLogoFileLookup();
    settings = new RentalSettingsUseCases(repo, logos);
  });

  it('la primera lectura crea la fila con los valores del prototipo (RN-8)', async () => {
    const read = await settings.get([SETTINGS]);

    expect(read).toMatchObject({
      companyName: "RIVERA'S RENT A CARS",
      contractStartNumber: 733,
      vatRate: '0.00',
      bufferHours: 1,
      minDriverAge: 21,
      logoUrl: null,
    });
    expect(read.clauses).toHaveLength(17);
    expect(read.accessories).toHaveLength(28);

    await settings.get([SETTINGS]);
    expect(repo.creations).toBe(1);
  });

  it.each([PERMISSIONS.rentals.actions.read.key, PERMISSIONS.fleet.actions.read.key, SETTINGS])(
    'se lee con %s',
    async (key) => {
      await expect(settings.get([key])).resolves.toHaveProperty('companyName');
    },
  );

  it('403 sin ninguna de las tres claves', async () => {
    const error = await captureApiError(settings.get([PERMISSIONS.renters.actions.read.key]));

    expect(error.status).toBe(403);
  });

  it('guarda la fila entera, con el logo y su url', async () => {
    logos.ids.add(LOGO);

    const saved = await settings.update({
      ...RENTAL_SETTINGS_DEFAULTS,
      vatRate: '13.00',
      accessories: ['Antena'],
      logoFileId: LOGO,
    });

    expect(saved).toMatchObject({
      vatRate: '13.00',
      accessories: ['Antena'],
      logoUrl: `/rental-files/${LOGO}`,
    });
  });

  it('422 con un logo que no existe', async () => {
    const error = await captureApiError(
      settings.update({ ...RENTAL_SETTINGS_DEFAULTS, logoFileId: LOGO }),
    );

    expect(error.status).toBe(422);
    expect(error.body.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });
});
