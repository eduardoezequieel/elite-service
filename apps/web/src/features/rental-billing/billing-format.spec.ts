import {
  collectibleCents,
  depositStatus,
  salvadorInstant,
  salvadorLocalNow,
} from './billing-format';

describe('depositStatus (098 RN-2)', () => {
  const base = { deposit: '100.00', depositReturnedAmount: null, depositTransferredToId: null };

  it('en custodia, devuelto con lo retenido, transferido o sin depósito', () => {
    expect(depositStatus(base)).toEqual({ kind: 'held', amount: '100.00' });
    expect(depositStatus({ ...base, depositReturnedAmount: '80.00' })).toEqual({
      kind: 'returned',
      amount: '100.00',
      returned: '80.00',
      retained: '20.00',
    });
    expect(depositStatus({ ...base, depositTransferredToId: 'b' })).toMatchObject({
      kind: 'transferred',
      toId: 'b',
    });
    expect(depositStatus({ ...base, deposit: '0.00' })).toEqual({ kind: 'none' });
  });
});

describe('collectibleCents', () => {
  it('no baja de cero si se cobró de más', () => {
    expect(collectibleCents('20.00')).toBe(2000);
    expect(collectibleCents('-5.00')).toBe(0);
  });
});

describe('salvadorInstant', () => {
  it('lee el datetime-local como hora de El Salvador', () => {
    expect(salvadorInstant('2026-10-01T14:30')).toBe('2026-10-01T20:30:00.000Z');
  });

  it('vacío o incompleto es null', () => {
    expect(salvadorInstant('')).toBeNull();
    expect(salvadorInstant('2026-10-01')).toBeNull();
  });

  it('salvadorLocalNow da la hora del negocio', () => {
    expect(salvadorLocalNow(new Date('2026-10-01T20:30:00Z'))).toBe('2026-10-01T14:30');
  });
});
