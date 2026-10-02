import {
  matchesTicketFilters,
  summarizeTickets,
  ticketFacets,
  type TicketDigest,
} from './ticket-list';

function digest(overrides: Partial<TicketDigest> = {}): TicketDigest {
  return {
    status: 'OPEN',
    totalCents: 1000,
    bodyType: { id: 'sedan', name: 'Sedán' },
    serviceLines: [{ serviceId: 's1', serviceName: 'Lavado básico' }],
    washers: [{ id: 'e1', fullName: 'Carlos' }],
    paymentMethods: [],
    ...overrides,
  };
}

describe('summarizeTickets (102)', () => {
  it('cuenta la cola, los listos, lo cobrado y lo no anulado', () => {
    const summary = summarizeTickets([
      digest({ status: 'OPEN' }),
      digest({ status: 'WASHING' }),
      digest({ status: 'READY' }),
      digest({ status: 'PAID', totalCents: 1250 }),
      digest({ status: 'PAID', totalCents: 750 }),
      digest({ status: 'VOID' }),
    ]);

    expect(summary).toEqual({
      queued: 2,
      ready: 1,
      paidCount: 2,
      paidTotal: '20.00',
      nonVoid: 5,
      all: 6,
    });
  });

  it('sin lavados todo es cero', () => {
    expect(summarizeTickets([])).toEqual({
      queued: 0,
      ready: 0,
      paidCount: 0,
      paidTotal: '0.00',
      nonVoid: 0,
      all: 0,
    });
  });
});

describe('matchesTicketFilters (102)', () => {
  it('sin filtros entra todo', () => {
    expect(matchesTicketFilters(digest(), {})).toBe(true);
  });

  it('carrocería', () => {
    expect(matchesTicketFilters(digest(), { bodyTypeId: 'sedan' })).toBe(true);
    expect(matchesTicketFilters(digest(), { bodyTypeId: 'pickup' })).toBe(false);
  });

  it('servicio por id, o por nombre cuando la línea no tiene servicio', () => {
    expect(matchesTicketFilters(digest(), { serviceId: 's1' })).toBe(true);
    expect(matchesTicketFilters(digest(), { serviceId: 'Lavado básico' })).toBe(false);

    const orphan = digest({ serviceLines: [{ serviceId: null, serviceName: 'Encerado' }] });
    expect(matchesTicketFilters(orphan, { serviceId: 'Encerado' })).toBe(true);
  });

  it('empleado, y «none» para los sin asignar', () => {
    expect(matchesTicketFilters(digest(), { washerId: 'e1' })).toBe(true);
    expect(matchesTicketFilters(digest(), { washerId: 'e2' })).toBe(false);
    expect(matchesTicketFilters(digest(), { washerId: 'none' })).toBe(false);
    expect(matchesTicketFilters(digest({ washers: [] }), { washerId: 'none' })).toBe(true);
  });

  it('pago: «pending» sin pagos; un método, si algún pago lo usó', () => {
    expect(matchesTicketFilters(digest(), { payment: 'pending' })).toBe(true);

    const split = digest({ status: 'PAID', paymentMethods: ['CASH', 'CARD'] });
    expect(matchesTicketFilters(split, { payment: 'pending' })).toBe(false);
    expect(matchesTicketFilters(split, { payment: 'CARD' })).toBe(true);
    expect(matchesTicketFilters(split, { payment: 'TRANSFER' })).toBe(false);
  });
});

describe('ticketFacets (102)', () => {
  it('junta las opciones en el orden de las filas, sin repetir', () => {
    const facets = ticketFacets([
      digest(),
      digest({
        bodyType: { id: 'pickup', name: 'Pick-up' },
        serviceLines: [
          { serviceId: 's1', serviceName: 'Lavado básico' },
          { serviceId: null, serviceName: 'Encerado' },
        ],
        washers: [],
      }),
    ]);

    expect(facets).toEqual({
      bodyTypes: [
        { id: 'sedan', name: 'Sedán' },
        { id: 'pickup', name: 'Pick-up' },
      ],
      services: [
        { value: 's1', label: 'Lavado básico' },
        { value: 'Encerado', label: 'Encerado' },
      ],
      washers: [{ id: 'e1', fullName: 'Carlos' }],
      hasUnassigned: true,
    });
  });
});
