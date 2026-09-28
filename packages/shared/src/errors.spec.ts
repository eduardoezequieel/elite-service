import { API_ERROR_CODES, isApiErrorCode } from './errors';

describe('isApiErrorCode', () => {
  it('reconoce todos los códigos del catálogo', () => {
    expect(Object.values(API_ERROR_CODES).every(isApiErrorCode)).toBe(true);
  });

  it.each(['NOPE', '', 'not_found', 'toString', '__proto__'])('rechaza %p', (value) => {
    expect(isApiErrorCode(value)).toBe(false);
  });
});
