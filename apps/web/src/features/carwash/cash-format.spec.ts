import { METHOD_LABELS, METHOD_STAMP } from './cash-format';

describe('payment method stamp (038)', () => {
  it('nombra los tres métodos', () => {
    expect(METHOD_LABELS.CASH).toBe('Efectivo');
    expect(METHOD_LABELS.CARD).toBe('Tarjeta');
    expect(METHOD_LABELS.TRANSFER).toBe('Transferencia');
  });

  it('asigna un tono distinto a cada método', () => {
    expect(METHOD_STAMP.CASH.tone).toBe('green');
    expect(METHOD_STAMP.CARD.tone).toBe('blue');
    expect(METHOD_STAMP.TRANSFER.tone).toBe('amber');
  });
});
