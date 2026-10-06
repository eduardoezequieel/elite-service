import {
  PAYMENT_METHOD_LABELS,
  createFineSchema,
  createPaymentSchema,
  depositReturnSchema,
  fineResolveQuerySchema,
  finesQuerySchema,
  voidPaymentSchema,
} from './billing';

const VEHICLE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('createPaymentSchema (098)', () => {
  it('normaliza el monto y deja vacíos como null', () => {
    expect(
      createPaymentSchema.parse({ amount: 30, method: 'CASH', reference: '  ', note: '' }),
    ).toEqual({ amount: '30.00', method: 'CASH', reference: null, note: null });
  });

  it('rechaza cero y negativos (RN-1)', () => {
    expect(createPaymentSchema.safeParse({ amount: '0', method: 'CASH' }).success).toBe(false);
    expect(createPaymentSchema.safeParse({ amount: '-5', method: 'CASH' }).success).toBe(false);
  });

  it('exige una forma de pago conocida (RN-6)', () => {
    expect(createPaymentSchema.safeParse({ amount: '10', method: 'CHEQUE' }).success).toBe(false);
  });

  it('acepta paidAt con zona y rechaza uno sin zona', () => {
    expect(
      createPaymentSchema.safeParse({
        amount: '10',
        method: 'CARD',
        paidAt: '2026-10-01T10:00:00-06:00',
      }).success,
    ).toBe(true);
    expect(
      createPaymentSchema.safeParse({ amount: '10', method: 'CARD', paidAt: '2026-10-01 10:00' })
        .success,
    ).toBe(false);
  });

  it('corta la referencia larga', () => {
    expect(
      createPaymentSchema.safeParse({ amount: '10', method: 'TRANSFER', reference: 'x'.repeat(61) })
        .success,
    ).toBe(false);
  });
});

describe('voidPaymentSchema', () => {
  it('pide un motivo de al menos 3 letras', () => {
    expect(voidPaymentSchema.safeParse({ reason: ' no ' }).success).toBe(false);
    expect(voidPaymentSchema.parse({ reason: ' Doble cobro ' })).toEqual({
      reason: 'Doble cobro',
    });
  });
});

describe('depositReturnSchema', () => {
  it('acepta cero (se retiene todo) y normaliza', () => {
    expect(depositReturnSchema.parse({ amount: 0 })).toEqual({ amount: '0.00' });
    expect(depositReturnSchema.parse({ amount: '80', method: 'CASH', note: 'Rayón' })).toEqual({
      amount: '80.00',
      method: 'CASH',
      note: 'Rayón',
    });
  });

  it('rechaza negativos', () => {
    expect(depositReturnSchema.safeParse({ amount: '-1' }).success).toBe(false);
  });
});

describe('createFineSchema', () => {
  const fine = {
    vehicleId: VEHICLE,
    occurredAt: '2026-10-01T15:00:00Z',
    amount: '57.14',
    description: 'Exceso de velocidad',
    chargeToCustomer: true,
  };

  it('acepta una multa completa', () => {
    expect(createFineSchema.parse(fine)).toEqual(fine);
  });

  it('pide carro, fecha válida, monto positivo y descripción', () => {
    expect(createFineSchema.safeParse({ ...fine, vehicleId: 'x' }).success).toBe(false);
    expect(createFineSchema.safeParse({ ...fine, occurredAt: 'ayer' }).success).toBe(false);
    expect(createFineSchema.safeParse({ ...fine, amount: '0' }).success).toBe(false);
    expect(createFineSchema.safeParse({ ...fine, description: ' ' }).success).toBe(false);
  });
});

describe('queries', () => {
  it('finesQuerySchema: todo opcional, ids y días válidos', () => {
    expect(finesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
    expect(finesQuerySchema.parse({ page: '2', pageSize: '25' })).toMatchObject({
      page: 2,
      pageSize: 25,
    });
    expect(finesQuerySchema.safeParse({ vehicleId: 'x' }).success).toBe(false);
    expect(finesQuerySchema.safeParse({ from: '01/10/2026' }).success).toBe(false);
  });

  it('fineResolveQuerySchema exige carro e instante', () => {
    expect(fineResolveQuerySchema.safeParse({ vehicleId: VEHICLE }).success).toBe(false);
    expect(
      fineResolveQuerySchema.safeParse({ vehicleId: VEHICLE, occurredAt: '2026-10-01T15:00:00Z' })
        .success,
    ).toBe(true);
  });
});

describe('PAYMENT_METHOD_LABELS', () => {
  it('nombra las cuatro formas de pago', () => {
    expect(Object.values(PAYMENT_METHOD_LABELS)).toEqual([
      'Efectivo',
      'Tarjeta',
      'Transferencia',
      'Otro',
    ]);
  });
});
