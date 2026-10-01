import {
  DEFAULT_PRINT_OPTIONS,
  contractIntro,
  contractMoney,
  damageRows,
  formatContractNumber,
  pageOrder,
  paperDate,
  paperDateParts,
  paperTime,
  parsePrintOptions,
  sheetCount,
} from './print-layout';

const kinds = (options: Parameters<typeof pageOrder>[0]) =>
  pageOrder(options).map((page) => `${page.copy}:${page.kind}`);

describe('documentos impresos de la renta (097)', () => {
  it('el número sale con 4 dígitos y ceros; sin número, vacío', () => {
    expect(formatContractNumber(733)).toBe('0733');
    expect(formatContractNumber(7)).toBe('0007');
    expect(formatContractNumber(12345)).toBe('12345');
    expect(formatContractNumber(null)).toBe('');
  });

  it('original y copia a una cara: todas las caras en secuencia', () => {
    expect(kinds({ sets: 'both', duplex: false, includeInspection: true })).toEqual([
      'original:contract-front',
      'original:contract-back',
      'original:inspection',
      'copy:contract-front',
      'copy:contract-back',
      'copy:inspection',
    ]);
    expect(sheetCount({ sets: 'both', duplex: false, includeInspection: true })).toBe(6);
  });

  it('a doble cara el reverso queda al dorso y el juego siguiente arranca en hoja nueva', () => {
    expect(kinds({ sets: 'both', duplex: true, includeInspection: true })).toEqual([
      'original:contract-front',
      'original:contract-back',
      'original:inspection',
      'original:blank',
      'copy:contract-front',
      'copy:contract-back',
      'copy:inspection',
    ]);
    expect(sheetCount({ sets: 'both', duplex: true, includeInspection: true })).toBe(4);
  });

  it('sin inspección a doble cara no hace falta la cara en blanco', () => {
    expect(kinds({ sets: 'both', duplex: true, includeInspection: false })).toEqual([
      'original:contract-front',
      'original:contract-back',
      'copy:contract-front',
      'copy:contract-back',
    ]);
    expect(sheetCount({ sets: 'both', duplex: true, includeInspection: false })).toBe(2);
  });

  it('solo el original', () => {
    expect(kinds({ sets: 'original', duplex: true, includeInspection: true })).toEqual([
      'original:contract-front',
      'original:contract-back',
      'original:inspection',
    ]);
    expect(sheetCount({ sets: 'original', duplex: true, includeInspection: true })).toBe(2);
  });

  it('las opciones guardadas rotas caen al valor por defecto', () => {
    expect(parsePrintOptions(null)).toEqual(DEFAULT_PRINT_OPTIONS);
    expect(parsePrintOptions('{no es json')).toEqual(DEFAULT_PRINT_OPTIONS);
    expect(parsePrintOptions('{"sets":"copia","duplex":true}')).toEqual({
      ...DEFAULT_PRINT_OPTIONS,
      duplex: true,
    });
    expect(
      parsePrintOptions('{"sets":"original","duplex":false,"includeInspection":false}'),
    ).toEqual({ sets: 'original', duplex: false, includeInspection: false });
  });

  it('fechas en dd/mm/aaaa y horas en la hora del taller', () => {
    expect(paperDate('2026-10-12')).toBe('12/10/2026');
    expect(paperDate('2026-10-13T03:30:00.000Z')).toBe('12/10/2026');
    expect(paperDate(null)).toBe('');
    expect(paperTime('2026-10-12T16:05:00.000Z')).toBe('10:05 a. m.');
    expect(paperTime('2026-10-12T18:00:00.000Z')).toBe('12:00 p. m.');
    expect(paperTime('2026-10-13T05:45:00.000Z')).toBe('11:45 p. m.');
    expect(paperTime('2026-10-12T06:00:00.000Z')).toBe('12:00 a. m.');
    expect(paperDateParts('2026-10-02T03:00:00.000Z')).toEqual({
      day: '1',
      month: 'octubre',
      year: '2026',
    });
  });

  it('la introducción lleva el nombre del arrendante', () => {
    expect(contractIntro('Entre {ARRENDANTE} y el cliente; {ARRENDANTE} entrega', 'JOSUE')).toBe(
      'Entre JOSUE y el cliente; JOSUE entrega',
    );
  });

  it('la cuenta del anverso cierra con el total del API', () => {
    const money = contractMoney(
      {
        dailyRate: '30.00',
        cdwPerDay: '5.00',
        billableDays: 3,
        discount: '10.00',
        includesVat: false,
        totals: { rental: '105.00', total: '115.00', paid: '50.00', balance: '65.00' },
      },
      '13.00',
    );

    expect(money).toMatchObject({
      rentalCents: 9000,
      cdwCents: 1500,
      otherChargesCents: 2000,
      discountCents: 1000,
      vatCents: 0,
      totalCents: 11500,
      pendingCents: 6500,
    });
  });

  it('con IVA incluido el total se parte en base e impuesto', () => {
    const money = contractMoney(
      {
        dailyRate: '113.00',
        cdwPerDay: '0.00',
        billableDays: 1,
        discount: '0.00',
        includesVat: true,
        totals: { rental: '113.00', total: '113.00', paid: '200.00', balance: '-87.00' },
      },
      '13.00',
    );

    expect(money.subtotalCents).toBe(10000);
    expect(money.vatCents).toBe(1300);
    expect(money.pendingCents).toBe(0);
  });

  it('los daños se numeran en el orden de las zonas y los nuevos se marcan', () => {
    const rows = damageRows(
      { damages: [{ zone: 'trunk', description: 'rayón' }] },
      {
        damages: [
          { zone: 'trunk', description: 'rayón' },
          { zone: 'hood', description: '' },
        ],
      },
    );

    expect(rows).toEqual([
      { number: 1, zone: 'hood', atPickup: null, atReturn: 'Nuevo', isNew: true },
      { number: 2, zone: 'trunk', atPickup: 'rayón', atReturn: 'Igual', isNew: false },
    ]);
    expect(damageRows(null, null)).toEqual([]);
  });
});
