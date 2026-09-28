import {
  chargeErrorMessage,
  effectiveBankAccountId,
  paymentDetailsBlocker,
  paymentDetailsInput,
  transferUnavailableReason,
  withEffectiveAccount,
} from './payment-details';
import { chargeBlocker, type PaymentLine } from './charge-math';

const ACCOUNTS = ['acc-1', 'acc-2'];

describe('la cuenta de la transferencia (069 RN-4)', () => {
  it('con una sola cuenta activa queda elegida sola', () => {
    expect(effectiveBankAccountId(undefined, ['acc-1'])).toBe('acc-1');
  });

  it('con varias, vale la elegida si sigue activa, y si no ninguna', () => {
    expect(effectiveBankAccountId('acc-2', ACCOUNTS)).toBe('acc-2');
    expect(effectiveBankAccountId(undefined, ACCOUNTS)).toBeUndefined();
    expect(effectiveBankAccountId('gone', ACCOUNTS)).toBeUndefined();
  });

  it('solo toca los renglones de transferencia', () => {
    const cash = { method: 'CASH' as const };

    expect(withEffectiveAccount(cash, ['acc-1'])).toBe(cash);
    expect(withEffectiveAccount({ method: 'TRANSFER' as const }, ['acc-1'])).toEqual({
      method: 'TRANSFER',
      bankAccountId: 'acc-1',
    });
  });
});

describe('qué le falta a un renglón (069 RN-4, RN-5)', () => {
  it('sin cuentas activas la transferencia no se puede', () => {
    expect(paymentDetailsBlocker('TRANSFER', {}, [])).toBe('No hay cuentas registradas');
  });

  it('una transferencia pide cuenta activa y referencia', () => {
    expect(paymentDetailsBlocker('TRANSFER', { reference: '99' }, ACCOUNTS)).toBe(
      'Elegí la cuenta',
    );
    expect(
      paymentDetailsBlocker('TRANSFER', { bankAccountId: 'gone', reference: '99' }, ACCOUNTS),
    ).toBe('Elegí la cuenta');
    expect(
      paymentDetailsBlocker('TRANSFER', { bankAccountId: 'acc-1', reference: '  ' }, ACCOUNTS),
    ).toBe('Falta la referencia');
    expect(
      paymentDetailsBlocker(
        'TRANSFER',
        { bankAccountId: 'acc-1', reference: 'x'.repeat(41) },
        ACCOUNTS,
      ),
    ).toBe('Referencia muy larga');
    expect(
      paymentDetailsBlocker('TRANSFER', { bankAccountId: 'acc-1', reference: '998877' }, ACCOUNTS),
    ).toBeNull();
  });

  it('«Otro» pide qué fue, hasta 60 caracteres', () => {
    expect(paymentDetailsBlocker('OTHER', {})).toBe('Falta qué fue el pago');
    expect(paymentDetailsBlocker('OTHER', { description: 'x'.repeat(61) })).toBe(
      'Descripción muy larga',
    );
    expect(paymentDetailsBlocker('OTHER', { description: 'cheque' })).toBeNull();
  });

  it('efectivo y tarjeta no piden nada', () => {
    expect(paymentDetailsBlocker('CASH', {}, [])).toBeNull();
    expect(paymentDetailsBlocker('CARD', {}, [])).toBeNull();
  });
});

describe('lo que viaja en el renglón (069 RN-6)', () => {
  const draft = { bankAccountId: 'acc-1', reference: ' 998877 ', description: ' cheque ' };

  it('cada método manda solo lo suyo, recortado', () => {
    expect(paymentDetailsInput('TRANSFER', draft)).toEqual({
      bankAccountId: 'acc-1',
      reference: '998877',
    });
    expect(paymentDetailsInput('OTHER', draft)).toEqual({ description: 'cheque' });
    expect(paymentDetailsInput('CASH', draft)).toEqual({});
    expect(paymentDetailsInput('CARD', draft)).toEqual({});
  });
});

describe('el botón de cobrar con los datos del método (069)', () => {
  const base = { totalCents: 4000, tendered: '', cashDue: 0, lines: [] as PaymentLine[] };

  it('el pago único por transferencia espera cuenta y referencia', () => {
    expect(
      chargeBlocker({
        ...base,
        split: false,
        method: 'TRANSFER',
        details: {},
        bankAccountIds: ACCOUNTS,
      }),
    ).toBe('Elegí la cuenta');
    expect(
      chargeBlocker({
        ...base,
        split: false,
        method: 'TRANSFER',
        details: { bankAccountId: 'acc-1', reference: '1' },
        bankAccountIds: ACCOUNTS,
      }),
    ).toBeNull();
  });

  it('en el pago partido cada renglón lleva lo suyo', () => {
    const cash: PaymentLine = { id: 'a', method: 'CASH', amount: '20.00' };
    const other: PaymentLine = { id: 'b', method: 'OTHER', amount: '20.00' };
    const lines = [cash, other];

    expect(chargeBlocker({ ...base, split: true, lines, bankAccountIds: ACCOUNTS })).toBe(
      'Falta qué fue el pago',
    );
    expect(
      chargeBlocker({
        ...base,
        split: true,
        lines: [cash, { ...other, description: 'cheque' }],
        bankAccountIds: ACCOUNTS,
      }),
    ).toBeNull();
  });
});

describe('el rechazo por la cuenta (069)', () => {
  it('BANK_ACCOUNT_UNAVAILABLE se dice en la frase del cajero', () => {
    expect(chargeErrorMessage({ code: 'BANK_ACCOUNT_UNAVAILABLE', message: 'x' })).toMatch(
      /ya no está activa/,
    );
    expect(chargeErrorMessage({ code: 'OTHER', message: 'Del API' })).toBe('Del API');
  });
});

describe('cuándo «Transferencia» sale deshabilitada (069)', () => {
  it('sin cuentas activas dice que no hay', () => {
    expect(transferUnavailableReason({ isPending: false, isError: false, count: 0 })).toBe(
      'No hay cuentas registradas',
    );
  });

  it('mientras cargan o si fallaron, lo dice; con cuentas, se puede', () => {
    expect(transferUnavailableReason({ isPending: true, isError: false, count: 0 })).toBe(
      'Cargando cuentas…',
    );
    expect(transferUnavailableReason({ isPending: false, isError: true, count: 0 })).toBe(
      'No se pudieron cargar las cuentas',
    );
    expect(transferUnavailableReason({ isPending: false, isError: false, count: 1 })).toBeNull();
  });
});
