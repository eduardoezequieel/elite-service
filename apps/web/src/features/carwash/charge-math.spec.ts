import {
  accountBuckets,
  SALE_BUCKET_ID,
  accountTotalCents,
  fitLastLine,
  balanceOf,
  cashDueCents,
  changeCents,
  chargeBlocker,
  isCashShort,
  paidCents,
  remainingCents,
  spreadCents,
  type PaymentLine,
} from './charge-math';

const TICKETS = [
  { id: 't1', total: '22.00' },
  { id: 't2', total: '14.50' },
  { id: 't3', total: '24.00' },
];

function line(overrides: Partial<PaymentLine> = {}): PaymentLine {
  return { id: 'l1', method: 'CASH', amount: '0.00', ...overrides };
}

describe('la cuenta y sus pagos (059)', () => {
  it('el total de la cuenta es la suma de los lavados', () => {
    expect(accountTotalCents(TICKETS)).toBe(6050);
    expect(accountTotalCents([])).toBe(0);
  });

  it('los renglones de pago suman en centavos, y un campo vacío cuenta como cero', () => {
    expect(paidCents([line({ amount: '40.00' }), line({ id: 'l2', amount: '20.50' })])).toBe(6050);
    expect(paidCents([line({ amount: '' })])).toBe(0);
  });

  it('falta, cuadra o se pasó, siempre con la palabra (RN-3)', () => {
    const total = accountTotalCents(TICKETS);

    expect(balanceOf(remainingCents(total, [line({ amount: '59.00' })]))).toEqual({
      kind: 'short',
      label: 'Falta',
      cents: 150,
    });
    expect(balanceOf(remainingCents(total, [line({ amount: '60.50' })]))).toEqual({
      kind: 'even',
      label: 'Cuadra',
      cents: 0,
    });
    expect(balanceOf(remainingCents(total, [line({ amount: '61.00' })]))).toEqual({
      kind: 'over',
      label: 'Se pasó',
      cents: 50,
    });
  });
});

describe('el efectivo y el vuelto (059 RN-10)', () => {
  const total = 4350;

  it('con un solo pago, el efectivo a cobrar es el total solo si el método es efectivo', () => {
    expect(cashDueCents({ totalCents: total, split: false, lines: [], method: 'CASH' })).toBe(4350);
    expect(cashDueCents({ totalCents: total, split: false, lines: [], method: 'CARD' })).toBe(0);
  });

  it('con el pago partido, es la suma de los renglones en efectivo', () => {
    const lines = [
      line({ method: 'CARD', amount: '40.00' }),
      line({ id: 'l2', method: 'CASH', amount: '20.50' }),
    ];

    expect(cashDueCents({ totalCents: 6050, split: true, lines, method: 'CASH' })).toBe(2050);
  });

  it('$50 recibidos sobre $43.50 devuelven $6.50', () => {
    expect(changeCents('50.00', total)).toBe(650);
  });

  it('sin nada tecleado se asume pago justo: el cambio es cero y nada falta', () => {
    expect(changeCents('', total)).toBe(0);
    expect(isCashShort('', total)).toBe(false);
  });

  it('lo recibido nunca puede ser menor al efectivo a cobrar', () => {
    expect(isCashShort('40.00', total)).toBe(true);
    expect(isCashShort('43.50', total)).toBe(false);
    expect(isCashShort('50.00', total)).toBe(false);
  });
});

describe('por qué no se puede cobrar todavía', () => {
  const base = { totalCents: 6050, split: false, lines: [], tendered: '', cashDue: 0 };

  it('un solo pago que no es efectivo no tiene nada que bloquear', () => {
    expect(chargeBlocker(base)).toBeNull();
  });

  it('el pago partido que no cuadra dice cuánto falta o cuánto sobra', () => {
    expect(chargeBlocker({ ...base, split: true, lines: [line({ amount: '59.00' })] })).toBe(
      'Falta $1.50',
    );
    expect(chargeBlocker({ ...base, split: true, lines: [line({ amount: '61.00' })] })).toBe(
      'Se pasó por $0.50',
    );
    expect(chargeBlocker({ ...base, split: true, lines: [line({ amount: '60.50' })] })).toBeNull();
  });

  it('el efectivo que no alcanza bloquea el cobro y no llama al API', () => {
    expect(chargeBlocker({ ...base, tendered: '40.00', cashDue: 6050 })).toBe('Falta efectivo');
  });
});

describe('los renglones cuando cambia la cuenta', () => {
  it('la diferencia cae en el último renglón', () => {
    const lines = [line({ method: 'CARD', amount: '40.00' }), line({ id: 'l2', amount: '20.50' })];

    expect(fitLastLine(lines, 7050)).toEqual([
      { id: 'l1', method: 'CARD', amount: '40.00' },
      { id: 'l2', method: 'CASH', amount: '30.50' },
    ]);
  });

  it('y nunca lo deja en negativo', () => {
    expect(fitLastLine([line({ amount: '10.00' })], 0)).toEqual([
      { id: 'l1', method: 'CASH', amount: '0.00' },
    ]);
  });

  it('sin renglones no hay nada que reajustar', () => {
    expect(fitLastLine([], 5000)).toEqual([]);
  });
});

describe('el reparto por lavado (059 RN-5)', () => {
  it('reparte proporcional al total de cada lavado', () => {
    expect(spreadCents(6050, TICKETS)).toEqual([
      { ticketId: 't1', cents: 2200 },
      { ticketId: 't2', cents: 1450 },
      { ticketId: 't3', cents: 2400 },
    ]);
  });

  it('los centavos que no dividen exacto van al de mayor resto, y la suma cuadra', () => {
    const tickets = [
      { id: 'a', total: '10.00' },
      { id: 'b', total: '10.00' },
      { id: 'c', total: '10.00' },
    ];
    const shares = spreadCents(1000, tickets);

    expect(shares.reduce((sum, share) => sum + share.cents, 0)).toBe(1000);
    expect(shares).toEqual([
      { ticketId: 'a', cents: 334 },
      { ticketId: 'b', cents: 333 },
      { ticketId: 'c', cents: 333 },
    ]);
  });

  it('un renglón parcial también cuadra al centavo', () => {
    const shares = spreadCents(4000, TICKETS);

    expect(shares.reduce((sum, share) => sum + share.cents, 0)).toBe(4000);
    expect(shares).toEqual([
      { ticketId: 't1', cents: 1454 },
      { ticketId: 't2', cents: 959 },
      { ticketId: 't3', cents: 1587 },
    ]);
  });

  it('una cuenta de total cero no pierde ni inventa centavos', () => {
    expect(spreadCents(0, [{ id: 'a', total: '0.00' }])).toEqual([{ ticketId: 'a', cents: 0 }]);
    expect(spreadCents(0, [])).toEqual([]);
  });
});

describe('la venta suelta como una parte más (066)', () => {
  it('va al final, después de los lavados', () => {
    const buckets = accountBuckets(
      [
        { id: 't1', total: '14.00' },
        { id: 't2', total: '10.00' },
      ],
      300,
    );

    expect(buckets).toEqual([
      { id: 't1', total: '14.00' },
      { id: 't2', total: '10.00' },
      { id: SALE_BUCKET_ID, total: '3.00' },
    ]);
    expect(accountTotalCents(buckets)).toBe(2700);
    expect(spreadCents(2700, buckets).map((share) => share.cents)).toEqual([1400, 1000, 300]);
  });

  it('sin productos no hay parte de venta', () => {
    expect(accountBuckets([{ id: 't1', total: '14.00' }], null)).toEqual([
      { id: 't1', total: '14.00' },
    ]);
  });
});
