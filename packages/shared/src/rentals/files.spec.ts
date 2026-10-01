import { STORED_FILE_MAX_BYTES, isStoredFileMimeType, storedFileUrl } from './files';

describe('archivos de la rentadora (095 RN-7)', () => {
  it('5 MB de tope', () => {
    expect(STORED_FILE_MAX_BYTES).toBe(5_242_880);
  });

  it('solo JPEG, PNG y WebP', () => {
    expect(isStoredFileMimeType('image/png')).toBe(true);
    expect(isStoredFileMimeType('application/pdf')).toBe(false);
  });

  it('la ruta es relativa al API', () => {
    expect(storedFileUrl('abc')).toBe('/rental-files/abc');
  });
});
