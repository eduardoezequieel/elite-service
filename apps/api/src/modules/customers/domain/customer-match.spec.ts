import { findCustomerMatch, normalizeName, normalizePhone } from './customer-match';
import type { MatchCandidate } from './customer-match';

/**
 * RN-1: que cuenta como «ya existe este cliente».
 *
 * Cada caso de aca es una forma real de escribir el mismo dato en el mostrador
 * o en la tablet. Si alguno fallara, el sistema crearia el duplicado que esta
 * spec existe para evitar.
 */
describe('normalizePhone', () => {
  it('se queda solo con los digitos', () => {
    expect(normalizePhone('7777-8888')).toBe('77778888');
    expect(normalizePhone('7777 8888')).toBe('77778888');
    expect(normalizePhone('+503 7777 8888')).toBe('50377778888');
  });

  it('un telefono ausente o en blanco es cadena vacia', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
    expect(normalizePhone('   ')).toBe('');
  });
});

describe('normalizeName', () => {
  it('baja a minusculas, saca acentos y colapsa espacios', () => {
    expect(normalizeName('Juan Pérez')).toBe('juan perez');
    expect(normalizeName('JUAN PEREZ')).toBe('juan perez');
    expect(normalizeName('  juan   perez  ')).toBe('juan perez');
    expect(normalizeName('MARÍA JOSÉ NÚÑEZ')).toBe('maria jose nunez');
  });
});

describe('findCustomerMatch (RN-1)', () => {
  const juan: MatchCandidate = { id: 'c1', fullName: 'Juan Pérez', phone: '7777-8888' };
  const ana: MatchCandidate = { id: 'c2', fullName: 'Ana Ramos', phone: null };

  it('encuentra por nombre aunque cambien acentos, mayusculas y espacios', () => {
    expect(findCustomerMatch([juan, ana], { fullName: 'juan  perez' })).toEqual({
      candidate: juan,
      on: 'name',
    });
  });

  it('encuentra por telefono aunque cambie la puntuacion', () => {
    expect(findCustomerMatch([juan], { fullName: 'Otro Nombre', phone: '7777 8888' })).toEqual({
      candidate: juan,
      on: 'phone',
    });
    expect(findCustomerMatch([juan], { fullName: 'Otro Nombre', phone: '77778888' })).toEqual({
      candidate: juan,
      on: 'phone',
    });
  });

  it('con las dos coincidencias gana el telefono', () => {
    const otro: MatchCandidate = { id: 'c3', fullName: 'Juan Perez', phone: '2222-1111' };

    // El del mismo nombre esta primero en la lista, y aun asi gana el del
    // mismo telefono: la regla no depende del orden en que vengan.
    expect(findCustomerMatch([otro, juan], { fullName: 'Juan Pérez', phone: '7777-8888' })).toEqual(
      { candidate: juan, on: 'phone' },
    );
  });

  it('un telefono vacio no coincide con otro vacio', () => {
    expect(findCustomerMatch([ana], { fullName: 'Sofia Diaz' })).toBeNull();
    expect(findCustomerMatch([ana], { fullName: 'Sofia Diaz', phone: '' })).toBeNull();
    expect(findCustomerMatch([ana], { fullName: 'Sofia Diaz', phone: '   ' })).toBeNull();
  });

  it('sin coincidencia devuelve null', () => {
    expect(findCustomerMatch([juan, ana], { fullName: 'Nadie', phone: '2222-3333' })).toBeNull();
  });

  it('sin candidatos devuelve null', () => {
    expect(findCustomerMatch([], { fullName: 'Juan Pérez', phone: '7777-8888' })).toBeNull();
  });

  it('devuelve el primero cuando hay varios homonimos', () => {
    const primero: MatchCandidate = { id: 'c4', fullName: 'Juan Perez', phone: null };
    const segundo: MatchCandidate = { id: 'c5', fullName: 'JUAN PEREZ', phone: null };

    expect(findCustomerMatch([primero, segundo], { fullName: 'juan pérez' })).toEqual({
      candidate: primero,
      on: 'name',
    });
  });
});
