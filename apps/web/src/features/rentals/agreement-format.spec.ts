import {
  accountLines,
  agreementDays,
  agreementWhen,
  calendarDays,
  exactWhen,
  operationFilter,
  operationQuery,
  overdueBy,
  guaranteeLine,
  saleReturnPhrase,
  slotPlacement,
  whatsappHref,
} from './agreement-format';

describe('formato de rentas (096)', () => {
  it('WhatsApp con un celular de 8 dígitos le antepone 503; sin teléfono, deja elegir', () => {
    expect(whatsappHref('7742-1900', 'Hola')).toBe('https://wa.me/50377421900?text=Hola');
    expect(whatsappHref(null, 'Hola mundo')).toBe('https://wa.me/?text=Hola%20mundo');
  });

  it('la barra cae en sus columnas y marca lo que sigue afuera', () => {
    const days = calendarDays('2026-10-10', 7);
    expect(days[6]).toBe('2026-10-16');

    expect(
      slotPlacement({ start: '2026-10-11T16:00:00.000Z', end: '2026-10-13T16:00:00.000Z' }, days),
    ).toEqual({ index: 1, span: 3, continuesBefore: false, continuesAfter: false });

    expect(
      slotPlacement({ start: '2026-10-01T16:00:00.000Z', end: '2026-10-30T16:00:00.000Z' }, days),
    ).toEqual({ index: 0, span: 7, continuesBefore: true, continuesAfter: true });
  });

  it('el filtro de Rentas arranca en la calle; «Todas» y «Canceladas» ya no existen (117)', () => {
    expect(operationFilter(null)).toBe('IN_PROGRESS');
    expect(operationFilter('RESERVED')).toBe('RESERVED');
    expect(operationFilter('FINISHED')).toBe('FINISHED');
    expect(operationFilter('ALL')).toBe('IN_PROGRESS');
    expect(operationFilter('CANCELLED')).toBe('IN_PROGRESS');
  });

  it('«Ya volvió» son las devueltas de los últimos siete días (117, RN-1)', () => {
    expect(operationQuery('IN_PROGRESS', '2026-10-19')).toEqual({ status: ['IN_PROGRESS'] });
    expect(operationQuery('RESERVED', '2026-10-19')).toEqual({ status: ['RESERVED'] });
    expect(operationQuery('FINISHED', '2026-10-19')).toEqual({
      status: ['FINISHED'],
      from: '2026-10-12',
      to: '2026-10-19',
    });
  });

  it('habla la salida y el regreso sin mes ni a. m.', () => {
    expect(saleReturnPhrase('2026-10-08T15:00:00.000Z', '2026-10-12T15:00:00.000Z')).toBe(
      'sale jue 8, 9:00 → vuelve lun 12, 9:00',
    );
  });

  it('parte días y seguro, y el descuento resta', () => {
    const lines = accountLines({
      dailyRate: '35.00',
      cdwPerDay: '5.00',
      billableDays: 3,
      extraCharges: '0.00',
      extraChargesNote: null,
      extraKmCharge: '10.00',
      discount: '8.00',
      fines: [
        {
          id: 'f',
          vehicleId: 'v',
          vehicle: { plate: null, make: 'A', model: 'B' },
          agreementId: 'a',
          agreement: null,
          occurredAt: '2026-10-08T15:00:00.000Z',
          amount: '20.00',
          description: 'Multa',
          chargedToCustomer: true,
          createdByUserId: 'u',
          createdAt: '2026-10-08T15:00:00.000Z',
        },
      ],
    });

    expect(lines.map((line) => [line.key, line.amount, line.minus ?? false])).toEqual([
      ['days', '105.00', false],
      ['insurance', '15.00', false],
      ['fines', '20.00', false],
      ['km', '10.00', false],
      ['discount', '8.00', true],
    ]);
  });

  it('dice la garantía en una línea', () => {
    expect(
      guaranteeLine({
        deposit: '0.00',
        depositMethod: null,
        depositReturnedAmount: null,
        depositTransferredToId: null,
      }),
    ).toBe('Sin garantía');
    expect(
      guaranteeLine({
        deposit: '100.00',
        depositMethod: 'CASH',
        depositReturnedAmount: null,
        depositTransferredToId: null,
      }),
    ).toBe('Garantía $100 en efectivo');
    expect(
      guaranteeLine({
        deposit: '100.00',
        depositMethod: 'CASH',
        depositReturnedAmount: '80.00',
        depositTransferredToId: null,
      }),
    ).toBe('Devuelta $80');
  });

  it('una renta fuera del rango no se dibuja', () => {
    const days = calendarDays('2026-10-10', 7);
    expect(
      slotPlacement({ start: '2026-10-20T16:00:00.000Z', end: '2026-10-22T16:00:00.000Z' }, days),
    ).toBeNull();
  });
});

describe('«Cuándo» en la lista de Rentas (117)', () => {
  // Lunes 19 oct 2026, 10:00 en El Salvador (UTC−6).
  const NOW = new Date('2026-10-19T16:00:00.000Z');
  const PAID = { rental: '70.00', total: '70.00', paid: '70.00', balance: '0.00' };

  function agreement(overrides: Partial<Parameters<typeof agreementWhen>[0]>) {
    return {
      status: 'IN_PROGRESS' as const,
      plannedPickupAt: '2026-10-17T15:00:00.000Z',
      plannedReturnAt: '2026-10-20T15:00:00.000Z',
      actualPickupAt: null,
      actualReturnAt: null,
      totals: PAID,
      ...overrides,
    };
  }

  it('la fecha exacta dice Hoy, Mañana, Ayer o el día corto', () => {
    expect(exactWhen('2026-10-19T15:00:00.000Z', NOW)).toBe('Hoy, 9:00');
    expect(exactWhen('2026-10-20T15:00:00.000Z', NOW)).toBe('Mañana, 9:00');
    expect(exactWhen('2026-10-19T00:30:00.000Z', NOW)).toBe('Ayer, 18:30');
    expect(exactWhen('2026-10-03T15:00:00.000Z', NOW)).toBe('sáb 3 oct, 9:00');
  });

  it('el atraso va en días, o en horas si es menos de un día (RN-2)', () => {
    expect(overdueBy('2026-10-17T15:00:00.000Z', NOW)).toBe('2 días');
    expect(overdueBy('2026-10-18T15:00:00.000Z', NOW)).toBe('1 día');
    expect(overdueBy('2026-10-19T13:00:00.000Z', NOW)).toBe('3 horas');
    expect(overdueBy('2026-10-19T15:00:00.000Z', NOW)).toBe('1 hora');
    expect(overdueBy('2026-10-19T15:50:00.000Z', NOW)).toBe('1 hora');
  });

  it('reserva por salir y reserva que no llegó', () => {
    expect(
      agreementWhen(
        agreement({ status: 'RESERVED', plannedPickupAt: '2026-10-20T15:00:00.000Z' }),
        NOW,
      ),
    ).toEqual({ headline: 'Por entregar', detail: 'Mañana, 9:00', alert: false });
    expect(
      agreementWhen(
        agreement({ status: 'RESERVED', plannedPickupAt: '2026-10-19T13:00:00.000Z' }),
        NOW,
      ),
    ).toEqual({
      headline: 'No ha llegado · 3 horas',
      detail: 'Debía salir: Hoy, 7:00',
      alert: true,
    });
  });

  it('en la calle y atrasado', () => {
    expect(agreementWhen(agreement({}), NOW)).toEqual({
      headline: 'Regresa',
      detail: 'Mañana, 9:00',
      alert: false,
    });
    expect(agreementWhen(agreement({ plannedReturnAt: '2026-10-17T15:00:00.000Z' }), NOW)).toEqual({
      headline: 'Atrasado · 2 días',
      detail: 'Debía regresar: sáb 17 oct, 9:00',
      alert: true,
    });
  });

  it('devuelta con saldo y sin saldo', () => {
    const back = { status: 'FINISHED' as const, actualReturnAt: '2026-10-18T22:00:00.000Z' };

    expect(
      agreementWhen(
        agreement({ ...back, totals: { ...PAID, paid: '50.00', balance: '20.00' } }),
        NOW,
      ),
    ).toEqual({ headline: 'Debe $20', detail: 'Regresó: Ayer, 16:00', alert: true });
    expect(agreementWhen(agreement(back), NOW)).toEqual({
      headline: 'Regresó',
      detail: 'Ayer, 16:00',
      alert: false,
    });
  });

  it('las fechas del Historial van de día a día, lo real si ya pasó', () => {
    expect(
      agreementDays({
        plannedPickupAt: '2026-10-03T15:00:00.000Z',
        plannedReturnAt: '2026-10-05T15:00:00.000Z',
        actualPickupAt: null,
        actualReturnAt: null,
      }),
    ).toBe('sáb 3 oct → lun 5 oct');
    expect(
      agreementDays({
        plannedPickupAt: '2026-10-03T15:00:00.000Z',
        plannedReturnAt: '2026-10-05T15:00:00.000Z',
        actualPickupAt: '2026-10-03T15:00:00.000Z',
        actualReturnAt: '2026-10-06T15:00:00.000Z',
      }),
    ).toBe('sáb 3 oct → mar 6 oct');
  });
});
