import {
  METHOD_LABELS,
  METHOD_STAMP,
  otherPaymentLines,
  paymentDetailLabel,
  paymentDetailText,
} from './cash-format';

const AGRICOLA = {
  id: 'a1',
  bank: 'AGRICOLA' as const,
  bankName: 'Banco Agrícola',
  type: 'CHECKING' as const,
  number: '0012345678',
};

describe('payment method stamp (038, 069)', () => {
  it('nombra los cuatro métodos', () => {
    expect(METHOD_LABELS.CASH).toBe('Efectivo');
    expect(METHOD_LABELS.CARD).toBe('Tarjeta');
    expect(METHOD_LABELS.TRANSFER).toBe('Transferencia');
    expect(METHOD_LABELS.OTHER).toBe('Otro');
  });

  it('asigna un tono distinto a cada método', () => {
    expect(METHOD_STAMP.CASH.tone).toBe('green');
    expect(METHOD_STAMP.CARD.tone).toBe('blue');
    expect(METHOD_STAMP.TRANSFER.tone).toBe('amber');
    expect(METHOD_STAMP.OTHER.tone).toBe('neutral');
  });
});

describe('el pago con sus datos (069)', () => {
  it('una transferencia dice a qué cuenta entró y su referencia', () => {
    const payment = {
      method: 'TRANSFER' as const,
      bankAccount: AGRICOLA,
      reference: '998877',
      description: null,
    };

    expect(paymentDetailText(payment)).toBe('Agrícola ···5678 · Ref 998877');
    expect(paymentDetailLabel(payment)).toBe('Transferencia · Agrícola ···5678 · Ref 998877');
  });

  it('«Otro» dice qué fue', () => {
    expect(
      paymentDetailLabel({
        method: 'OTHER',
        bankAccount: null,
        reference: null,
        description: 'cheque',
      }),
    ).toBe('Otro · cheque');
  });

  it('la transferencia anterior a la 069, sin cuenta, queda en «Transferencia»', () => {
    const legacy = {
      method: 'TRANSFER' as const,
      bankAccount: null,
      reference: null,
      description: null,
    };

    expect(paymentDetailText(legacy)).toBeNull();
    expect(paymentDetailLabel(legacy)).toBe('Transferencia');
  });

  it('efectivo y tarjeta no agregan nada', () => {
    expect(paymentDetailLabel({ method: 'CASH' })).toBe('Efectivo');
    expect(paymentDetailText({ method: 'CARD' })).toBeNull();
  });
});

describe('la lista de «Otro» del turno (069 RN-7)', () => {
  it('solo los pagos «Otro», con qué fue y cuánto', () => {
    expect(
      otherPaymentLines([
        { id: 'p1', method: 'CASH', amount: '20.00' },
        { id: 'p2', method: 'OTHER', amount: '5.00', description: 'cheque' },
        { id: 'p3', method: 'OTHER', amount: '3.00', description: '  ' },
      ]),
    ).toEqual([
      { id: 'p2', description: 'cheque', amount: '5.00' },
      { id: 'p3', description: 'Sin descripción', amount: '3.00' },
    ]);
  });
});
