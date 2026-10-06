import {
  accountLines,
  agreementListFilter,
  agreementListQuery,
  calendarDays,
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

  it('el filtro de la lista arranca en la calle y «Todas» no manda estado', () => {
    expect(agreementListFilter(null)).toBe('IN_PROGRESS');
    expect(agreementListFilter('ALL')).toBe('ALL');
    expect(agreementListQuery('IN_PROGRESS')).toEqual({ status: ['IN_PROGRESS'] });
    expect(agreementListQuery('ALL')).toEqual({});
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
