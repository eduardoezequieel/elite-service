import { detectImageType, storedNameOf } from './stored-file';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe('detectImageType (095 RN-7)', () => {
  it('reconoce JPEG, PNG y WebP por su firma', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'image/png',
    );
    expect(detectImageType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBPVP8 ')))).toBe(
      'image/webp',
    );
  });

  it('un PDF no es imagen aunque diga serlo', () => {
    expect(detectImageType(bytes(...ascii('%PDF-1.7')))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });
});

describe('storedNameOf', () => {
  it('id + extensión', () => {
    expect(storedNameOf('abc', 'image/png')).toBe('abc.png');
    expect(storedNameOf('abc', 'image/jpeg')).toBe('abc.jpg');
  });
});
