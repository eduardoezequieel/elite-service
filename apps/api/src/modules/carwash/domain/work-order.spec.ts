import {
  canEditWashers,
  canTransition,
  isEditable,
  missingFieldsOf,
  nextStatus,
  rejectCharge,
  type WorkOrderAction,
  type WorkOrderStatus,
} from './work-order';

const ALL_STATUSES: WorkOrderStatus[] = ['OPEN', 'WASHING', 'READY', 'PAID', 'VOID'];
const ALL_ACTIONS: WorkOrderAction[] = ['start', 'ready', 'reopen', 'charge', 'void'];

describe('transiciones (RN-9)', () => {
  it.each([
    ['OPEN', 'start', 'WASHING'],
    ['OPEN', 'ready', 'READY'],
    ['WASHING', 'ready', 'READY'],
    ['READY', 'reopen', 'OPEN'],
    ['READY', 'charge', 'PAID'],
    ['OPEN', 'void', 'VOID'],
    ['WASHING', 'void', 'VOID'],
    ['READY', 'void', 'VOID'],
  ] as const)('%s + %s -> %s', (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
  });

  /** `PAID` y `VOID` son finales: de ahi no sale nada (RN-9, RN-11). */
  it.each(['PAID', 'VOID'] as const)('%s es final', (status) => {
    for (const action of ALL_ACTIONS) {
      expect(canTransition(status, action)).toBe(false);
    }
  });

  it('no se cobra un ticket que todavia no esta listo', () => {
    expect(canTransition('OPEN', 'charge')).toBe(false);
  });

  it('no se reabre lo que nunca se marco listo', () => {
    expect(canTransition('OPEN', 'reopen')).toBe(false);
  });

  it('una accion invalida devuelve null en vez de inventar un estado', () => {
    expect(nextStatus('PAID', 'void')).toBeNull();
  });

  it('toda transicion valida termina en un estado conocido', () => {
    for (const status of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        const next = nextStatus(status, action);

        if (next !== null) expect(ALL_STATUSES).toContain(next);
      }
    }
  });
});

describe('isEditable (RN-9)', () => {
  it('solo se edita lo abierto', () => {
    expect(isEditable('OPEN')).toBe(true);

    for (const status of ['WASHING', 'READY', 'PAID', 'VOID'] as const) {
      expect(isEditable(status)).toBe(false);
    }
  });
});

describe('canEditWashers (009 RN-7)', () => {
  it('se pueden cambiar en OPEN, WASHING y READY', () => {
    expect(canEditWashers('OPEN')).toBe(true);
    expect(canEditWashers('WASHING')).toBe(true);
    expect(canEditWashers('READY')).toBe(true);
  });

  it('en PAID y VOID quedan congelados', () => {
    expect(canEditWashers('PAID')).toBe(false);
    expect(canEditWashers('VOID')).toBe(false);
  });
});

describe('rejectCharge (RN-10)', () => {
  it('acepta el monto exacto sobre un ticket listo', () => {
    expect(rejectCharge('READY', 1400, 1400)).toBeNull();
  });

  it('rechaza un monto menor: no hay saldo ni abonos', () => {
    expect(rejectCharge('READY', 1400, 1000)).toBe('AMOUNT_MISMATCH');
  });

  it('rechaza un monto mayor: el vuelto no lo lleva el sistema', () => {
    expect(rejectCharge('READY', 1400, 2000)).toBe('AMOUNT_MISMATCH');
  });

  it('rechaza cobrar algo que no esta listo', () => {
    expect(rejectCharge('OPEN', 1400, 1400)).toBe('NOT_READY');
    expect(rejectCharge('PAID', 1400, 1400)).toBe('NOT_READY');
  });

  /** Un ticket en 0 es una cortesia, y una cortesia se anula (RN-5, RN-10). */
  it('rechaza cobrar un total en cero, aunque el monto coincida', () => {
    expect(rejectCharge('READY', 0, 0)).toBe('EMPTY_TOTAL');
  });

  it('el estado se revisa antes que el monto', () => {
    expect(rejectCharge('VOID', 0, 999)).toBe('NOT_READY');
  });
});

describe('missingFieldsOf (RN-7)', () => {
  const completo = {
    customerId: 'c1',
    vehicleId: 'v1',
    bodyTypeId: 'b1',
    serviceIds: ['s1'],
  };

  it('no le falta nada a un borrador completo', () => {
    expect(missingFieldsOf(completo)).toEqual([]);
  });

  it('exige cliente, vehiculo, tipo de carro y al menos un servicio', () => {
    expect(
      missingFieldsOf({ customerId: null, vehicleId: null, bodyTypeId: null, serviceIds: [] }),
    ).toEqual(['customerId', 'vehicleId', 'bodyTypeId', 'items']);
  });

  it('un ticket sin servicios no se abre', () => {
    expect(missingFieldsOf({ ...completo, serviceIds: [] })).toEqual(['items']);
  });

  /** Marca y color no estan en la lista a proposito: son opcionales (RN-7). */
  it('no exige marca ni color', () => {
    expect(missingFieldsOf(completo)).not.toContain('make');
    expect(missingFieldsOf(completo)).not.toContain('color');
  });
});
