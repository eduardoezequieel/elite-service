import { API_ERROR_CODES, PERMISSIONS, STORED_FILE_MAX_BYTES } from '@elite/shared';

import { captureApiError } from '../../users/application/testing/capture-api-error';
import { RentalFileUseCases } from './rental-file.usecases';
import {
  InMemoryFileStorage,
  InMemoryStoredFileRepository,
} from './testing/in-memory-stored-files';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = Uint8Array.from([...'%PDF-1.7'].map((char) => char.charCodeAt(0)));
const SETTINGS_USER = {
  id: '00000000-0000-4000-8000-0000000000aa',
  permissions: [PERMISSIONS.rentals.actions.settings.key],
};

describe('RentalFileUseCases (095 RN-7)', () => {
  let records: InMemoryStoredFileRepository;
  let storage: InMemoryFileStorage;
  let files: RentalFileUseCases;

  beforeEach(() => {
    records = new InMemoryStoredFileRepository();
    storage = new InMemoryFileStorage();
    files = new RentalFileUseCases(records, storage);
  });

  it('guarda un PNG como id + extensión y devuelve { id, url }', async () => {
    const ref = await files.upload(
      'LOGO',
      { bytes: PNG, sizeBytes: PNG.length, declaredMimeType: 'image/png' },
      SETTINGS_USER,
    );

    expect(ref.url).toBe(`/rental-files/${ref.id}`);
    expect(storage.files.has(`${ref.id}.png`)).toBe(true);
    expect(records.rows[0]).toMatchObject({ kind: 'LOGO', mimeType: 'image/png' });

    const downloaded = await files.download(ref.id);
    expect(downloaded.mimeType).toBe('image/png');
  });

  it('413 FILE_TOO_LARGE si pasa de 5 MB', async () => {
    const error = await captureApiError(
      files.upload(
        'LOGO',
        { bytes: PNG, sizeBytes: STORED_FILE_MAX_BYTES + 1, declaredMimeType: 'image/png' },
        SETTINGS_USER,
      ),
    );

    expect(error.status).toBe(413);
    expect(error.body.code).toBe(API_ERROR_CODES.FILE_TOO_LARGE);
  });

  it('415 FILE_TYPE_NOT_ALLOWED con un PDF, aunque diga ser PNG', async () => {
    for (const declaredMimeType of ['application/pdf', 'image/png']) {
      const error = await captureApiError(
        files.upload(
          'LOGO',
          { bytes: PDF, sizeBytes: PDF.length, declaredMimeType },
          SETTINGS_USER,
        ),
      );

      expect(error.status).toBe(415);
      expect(error.body.code).toBe(API_ERROR_CODES.FILE_TYPE_NOT_ALLOWED);
    }
    expect(storage.files.size).toBe(0);
  });

  it('403 sin rentals.manage ni rentals.settings', async () => {
    const error = await captureApiError(
      files.upload(
        'LOGO',
        { bytes: PNG, sizeBytes: PNG.length, declaredMimeType: 'image/png' },
        { id: SETTINGS_USER.id, permissions: [PERMISSIONS.fleet.actions.manage.key] },
      ),
    );

    expect(error.status).toBe(403);
  });

  it('422 sin archivo', async () => {
    const error = await captureApiError(files.upload('LOGO', null, SETTINGS_USER));

    expect(error.status).toBe(422);
  });

  it('404 si el archivo no existe', async () => {
    const error = await captureApiError(files.download('00000000-0000-4000-8000-000000000999'));

    expect(error.status).toBe(404);
  });
});
