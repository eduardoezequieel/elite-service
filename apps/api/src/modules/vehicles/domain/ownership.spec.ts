import { currentOwnerId, planTransfer, type OwnershipRow } from './ownership';

const ana: OwnershipRow = {
  customerId: 'ana',
  isCurrent: true,
  fromDate: new Date('2026-01-01'),
  toDate: null,
};

const jose: OwnershipRow = {
  customerId: 'jose',
  isCurrent: false,
  fromDate: new Date('2025-01-01'),
  toDate: new Date('2026-01-01'),
};

describe('planTransfer (RN-12)', () => {
  it('abre la primera propiedad de un vehiculo nuevo', () => {
    expect(planTransfer([], 'ana')).toEqual({ closePrevious: false, openNew: true });
  });

  /**
   * El caso que evita que la tabla de historial crezca sin decir nada: el
   * cliente habitual que vuelve cada mes no genera una fila por lavado.
   */
  it('no escribe nada si el cliente ya es el dueno actual', () => {
    expect(planTransfer([ana], 'ana')).toEqual({ closePrevious: false, openNew: false });
  });

  it('cierra la anterior y abre la nueva cuando cambia el dueno', () => {
    expect(planTransfer([ana], 'jose')).toEqual({ closePrevious: true, openNew: true });
  });

  it('ignora las filas ya cerradas al decidir', () => {
    expect(planTransfer([jose, ana], 'ana')).toEqual({ closePrevious: false, openNew: false });
  });

  it('vuelve a abrir si el dueno viejo regresa', () => {
    expect(planTransfer([jose, ana], 'jose')).toEqual({ closePrevious: true, openNew: true });
  });
});

describe('currentOwnerId', () => {
  it('devuelve el dueno vigente', () => {
    expect(currentOwnerId([jose, ana])).toBe('ana');
  });

  it('devuelve null si no hay ninguno vigente', () => {
    expect(currentOwnerId([jose])).toBeNull();
    expect(currentOwnerId([])).toBeNull();
  });
});
