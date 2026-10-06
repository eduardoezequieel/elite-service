import { importDateOf, renterFromImportRow, renterImportFieldOf } from './renters';

describe('renterImportFieldOf (RN-9)', () => {
  it.each([
    ['Nombre', 'fullName'],
    ['DUI', 'documentId'],
    ['Documento', 'documentId'],
    ['Licencia', 'licenseNumber'],
    ['Celular', 'mobilePhone'],
    ['Teléfono', 'phone'],
    ['E-mail', 'email'],
    ['Dirección', 'address'],
    ['Fecha de nacimiento', 'birthDate'],
    ['País', 'country'],
  ])('reconoce «%s»', (header, field) => {
    expect(renterImportFieldOf(header)).toBe(field);
  });

  it('ignora una columna que no conoce', () => {
    expect(renterImportFieldOf('Color favorito')).toBeNull();
  });
});

describe('importDateOf', () => {
  it('acepta ISO y día primero', () => {
    expect(importDateOf('1990-03-05')).toBe('1990-03-05');
    expect(importDateOf('05/03/1990')).toBe('1990-03-05');
    expect(importDateOf('5-3-1990')).toBe('1990-03-05');
  });

  it('rechaza un día que no existe', () => {
    expect(importDateOf('31/02/1990')).toBeNull();
    expect(importDateOf('ayer')).toBeNull();
  });
});

describe('renterFromImportRow', () => {
  it('arma el alta con las columnas reconocidas', () => {
    const result = renterFromImportRow({
      Nombre: ' Ana López ',
      DUI: '01234567-8',
      Nacimiento: '05/03/1990',
      Correo: 'ANA@MAIL.COM',
      Extra: 'se ignora',
    });

    expect(result).toEqual({
      input: expect.objectContaining({
        fullName: 'Ana López',
        documentId: '01234567-8',
        birthDate: '1990-03-05',
        email: 'ana@mail.com',
        isBlocked: false,
      }),
    });
  });

  it('sin nombre, se omite', () => {
    expect(renterFromImportRow({ DUI: '1', Nombre: '  ' })).toEqual({ reason: 'Sin nombre.' });
  });

  it('una fecha ilegible omite la fila con su motivo', () => {
    expect(renterFromImportRow({ Nombre: 'Ana', Nacimiento: 'marzo' })).toEqual({
      reason: 'La fecha «marzo» no se entiende.',
    });
  });

  it('un correo inválido omite la fila', () => {
    expect(renterFromImportRow({ Nombre: 'Ana', Email: 'no-es-correo' })).toEqual({
      reason: 'Escribí un correo válido.',
    });
  });
});
