import {
  DEFAULT_PAGE_SIZE,
  MAX_MONEY,
  MAX_QUANTITY,
  TICKET_PAYMENT_PENDING,
  TICKET_WASHER_NONE,
  chargePaymentSchema,
  chargeTicketSchema,
  createFloorTicketSchema,
  createOfficeTicketSchema,
  createServiceSchema,
  employeesQuerySchema,
  moneySchema,
  quantitySchema,
  signedQuantitySchema,
  ticketsQuerySchema,
  updateTicketSchema,
} from './schemas';

const ACCOUNT_ID = '7f1d2f4e-2b3a-4c5d-8e9f-0a1b2c3d4e5f';

/** Los mensajes de un parse fallido, para leer en una línea qué se rechazó. */
function issuesOf(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('moneySchema', () => {
  it.each([
    ['8.5', '8.50'],
    ['8', '8.00'],
    ['8.50', '8.50'],
    [' 14 ', '14.00'],
    ['0', '0.00'],
    [MAX_MONEY, MAX_MONEY],
    [8.5, '8.50'],
    [0.1 + 0.2, '0.30'],
  ])('acepta %p y lo normaliza a %p', (input, expected) => {
    expect(moneySchema.parse(input)).toBe(expected);
  });

  it.each(['-1', '-0.50', -3])('rechaza el negativo %p', (value) => {
    expect(moneySchema.safeParse(value).success).toBe(false);
  });

  it.each(['8.555', '0.001', '1.2.3'])(
    'rechaza %p: más de dos decimales o mal escrito',
    (value) => {
      expect(moneySchema.safeParse(value).success).toBe(false);
    },
  );

  it.each(['abc', '', '8,50', '$8', '.5', '8.', '1e3'])('rechaza el texto %p', (value) => {
    const result = moneySchema.safeParse(value);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Escribí un monto válido, con hasta dos decimales.',
    );
  });

  it('rechaza lo que no es cadena ni número', () => {
    expect(moneySchema.safeParse(null).success).toBe(false);
    expect(moneySchema.safeParse({ amount: '8' }).success).toBe(false);
  });

  // Visto al escribir este test: un número con tres decimales pasa por
  // `toFixed(2)` y se redondea en vez de rechazarse como el texto `'8.555'`.
  it.todo('rechaza el número 8.555 como rechaza el texto (hoy lo redondea a "8.55" y lo acepta)');
});

/**
 * El tope de los montos del contrato (antes en `apps/api`, spec 078). Sin
 * tope, un campo de veinte dígitos llegaba hasta Postgres y reventaba contra
 * la columna `Decimal(12,2)`.
 */
describe('tope de los montos del contrato', () => {
  const service = (defaultPrice: string) => ({
    name: 'Pulido',
    categoryId: ACCOUNT_ID,
    defaultPrice,
  });

  it.each(['0', '8', '8.5', '8.50', '99999.99', '099999.99'])('acepta %s', (value) => {
    expect(createServiceSchema.safeParse(service(value)).success).toBe(true);
  });

  it.each(['100000.00', '2392313213123123123213', '9999999999.99'])('rechaza %s', (value) => {
    const result = createServiceSchema.safeParse(service(value));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(`El monto no puede pasar de $${MAX_MONEY}.`);
  });

  it('el mismo tope vale para el cobro, no solo para el catálogo', () => {
    expect(chargeTicketSchema.safeParse({ method: 'CASH', amount: '100000.00' }).success).toBe(
      false,
    );
    expect(chargeTicketSchema.safeParse({ method: 'CASH', amount: '14.00' }).success).toBe(true);
  });
});

describe('decimalQuantity', () => {
  describe('sin signo (quantitySchema)', () => {
    it.each([
      ['2', '2.000'],
      ['2.5', '2.500'],
      ['0.125', '0.125'],
      ['007', '7.000'],
      [3, '3.000'],
      [MAX_QUANTITY, MAX_QUANTITY],
    ])('acepta %p y lo normaliza a %p', (input, expected) => {
      expect(quantitySchema.parse(input)).toBe(expected);
    });

    it.each(['0', '0.000', '-1', '1.2345', 'dos', '', '100000'])('rechaza %p', (value) => {
      expect(quantitySchema.safeParse(value).success).toBe(false);
    });

    it('dice por qué rechaza el cero y el tope', () => {
      expect(quantitySchema.safeParse('0').error?.issues[0]?.message).toBe(
        'La cantidad no puede ser cero.',
      );
      expect(quantitySchema.safeParse('100000').error?.issues[0]?.message).toBe(
        `La cantidad no puede pasar de ${MAX_QUANTITY}.`,
      );
    });
  });

  describe('con signo (signedQuantitySchema)', () => {
    it.each([
      ['-1.5', '-1.500'],
      ['-007', '-7.000'],
      ['4', '4.000'],
      [-2, '-2.000'],
      [`-${MAX_QUANTITY}`, `-${MAX_QUANTITY}`],
    ])('acepta %p y lo normaliza a %p', (input, expected) => {
      expect(signedQuantitySchema.parse(input)).toBe(expected);
    });

    it.each(['0', '-0', '-0.000', '-100000', '-1.2345', '--1'])('rechaza %p', (value) => {
      expect(signedQuantitySchema.safeParse(value).success).toBe(false);
    });
  });
});

/** `refinePaymentLine` (069 RN-4/5/6), probado por el schema que lo usa. */
describe('refinePaymentLine', () => {
  it.each(['CASH', 'CARD'])('%s va solo con el monto', (method) => {
    expect(chargePaymentSchema.parse({ method, amount: '8.5' })).toEqual({
      method,
      amount: '8.50',
    });
  });

  it('un método por renglón: fuera del catálogo o varios juntos no pasa', () => {
    expect(chargePaymentSchema.safeParse({ method: 'BITCOIN', amount: '1' }).success).toBe(false);
    expect(chargePaymentSchema.safeParse({ method: ['CASH', 'CARD'], amount: '1' }).success).toBe(
      false,
    );
    expect(chargePaymentSchema.safeParse({ amount: '1' }).success).toBe(false);
  });

  describe('TRANSFER lleva cuenta y referencia (RN-4)', () => {
    it('acepta la transferencia completa', () => {
      const line = { method: 'TRANSFER', amount: '20', bankAccountId: ACCOUNT_ID, reference: 'A1' };

      expect(chargePaymentSchema.safeParse(line).success).toBe(true);
    });

    it('sin cuenta falla en `bankAccountId`', () => {
      const result = chargePaymentSchema.safeParse({
        method: 'TRANSFER',
        amount: '20',
        reference: 'A1',
      });

      expect(issuesOf(result)).toEqual(['bankAccountId']);
    });

    it('sin referencia falla en `reference`', () => {
      const result = chargePaymentSchema.safeParse({
        method: 'TRANSFER',
        amount: '20',
        bankAccountId: ACCOUNT_ID,
      });

      expect(issuesOf(result)).toEqual(['reference']);
    });

    it('sin ninguna de las dos marca los dos campos', () => {
      const result = chargePaymentSchema.safeParse({ method: 'TRANSFER', amount: '20' });

      expect(issuesOf(result)).toEqual(['bankAccountId', 'reference']);
    });

    it('no lleva descripción', () => {
      const result = chargePaymentSchema.safeParse({
        method: 'TRANSFER',
        amount: '20',
        bankAccountId: ACCOUNT_ID,
        reference: 'A1',
        description: 'cheque',
      });

      expect(issuesOf(result)).toEqual(['description']);
    });
  });

  describe('OTHER lleva descripción (RN-5)', () => {
    it('acepta «Otro» con su descripción', () => {
      const line = { method: 'OTHER', amount: '5', description: 'Cheque 0012' };

      expect(chargePaymentSchema.safeParse(line).success).toBe(true);
    });

    it('sin descripción falla en `description`', () => {
      const result = chargePaymentSchema.safeParse({ method: 'OTHER', amount: '5' });

      expect(issuesOf(result)).toEqual(['description']);
    });

    it('no lleva cuenta ni referencia', () => {
      const result = chargePaymentSchema.safeParse({
        method: 'OTHER',
        amount: '5',
        description: 'Cheque',
        bankAccountId: ACCOUNT_ID,
        reference: 'A1',
      });

      expect(issuesOf(result)).toEqual(['bankAccountId', 'reference']);
    });
  });

  describe('los demás métodos no llevan esos campos (RN-6)', () => {
    it.each(['CASH', 'CARD'])('%s rechaza cuenta, referencia y descripción', (method) => {
      const result = chargePaymentSchema.safeParse({
        method,
        amount: '5',
        bankAccountId: ACCOUNT_ID,
        reference: 'A1',
        description: 'algo',
      });

      expect(issuesOf(result)).toEqual(['bankAccountId', 'reference', 'description']);
    });
  });

  it('el cobro de un lavado aplica la misma regla', () => {
    expect(
      issuesOf(chargeTicketSchema.safeParse({ method: 'TRANSFER', amount: '20', reference: 'A1' })),
    ).toEqual(['bankAccountId']);
  });
});

describe('combos en el lavado (spec 104)', () => {
  const COMBO_ID = '3c2b1a09-8f7e-4d6c-9b5a-4f3e2d1c0b0a';
  const base = { vehicle: { plate: 'P123456' }, items: [] };

  it('el alta trae `combos` vacío si no viene', () => {
    expect(createFloorTicketSchema.parse(base).combos).toEqual([]);
    expect(createOfficeTicketSchema.parse(base).combos).toEqual([]);
  });

  it('el alta acepta combos por id y rechaza un id inválido', () => {
    expect(
      createFloorTicketSchema.parse({ ...base, combos: [{ comboId: COMBO_ID }] }).combos,
    ).toEqual([{ comboId: COMBO_ID }]);
    expect(
      issuesOf(createOfficeTicketSchema.safeParse({ ...base, combos: [{ comboId: 'x' }] })),
    ).toEqual(['combos.0.comboId']);
  });

  it('la edición deja `combos` ausente si no viene: no se tocan', () => {
    expect(updateTicketSchema.parse({}).combos).toBeUndefined();
    expect(updateTicketSchema.parse({ combos: [] }).combos).toEqual([]);
  });
});

describe('ticketsQuerySchema (spec 102)', () => {
  it('lee la lista de estados, ignora lo que no es un estado y pone la página por defecto', () => {
    const parsed = ticketsQuerySchema.parse({ status: 'open, ready,nope' });

    expect(parsed.status).toEqual(['OPEN', 'READY']);
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('acepta «Sin asignar» y «Pendiente» en los filtros', () => {
    const parsed = ticketsQuerySchema.parse({
      washerId: TICKET_WASHER_NONE,
      payment: TICKET_PAYMENT_PENDING,
      page: '2',
      pageSize: '25',
    });

    expect(parsed).toMatchObject({ washerId: 'none', payment: 'pending', page: 2, pageSize: 25 });
  });

  it('rechaza un empleado que no es un uuid ni «none»', () => {
    expect(ticketsQuerySchema.safeParse({ washerId: 'carlos' }).success).toBe(false);
  });
});

describe('listas con `active` (spec 102)', () => {
  it('traduce la bandera de la URL', () => {
    expect(employeesQuerySchema.parse({ active: 'false' }).active).toBe(false);
    expect(employeesQuerySchema.parse({}).active).toBeUndefined();
  });
});
