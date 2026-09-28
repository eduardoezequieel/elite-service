import {
  NO_ACCOUNT_LABEL,
  closeSnapshot,
  differenceCash,
  expectedCash,
  paymentTotals,
  transferByAccount,
} from './cash-session';
import type { AccountedPayment } from './cash-session';

describe('cash-session arithmetic', () => {
  const cash14 = { method: 'CASH' as const, amount: 1400 };
  const card10 = { method: 'CARD' as const, amount: 1000 };
  const transfer5 = { method: 'TRANSFER' as const, amount: 500 };

  it('sums each method and ignores card/transfer in expected cash', () => {
    const totals = paymentTotals([cash14, card10, transfer5]);

    expect(totals).toEqual({ cashTotal: 1400, cardTotal: 1000, transferTotal: 500, otherTotal: 0 });
    expect(expectedCash(2000, totals.cashTotal)).toBe(3400);
  });

  it('expected cash is float plus cash charges only (RN-4)', () => {
    expect(expectedCash(2000, 1400)).toBe(3400);
    expect(expectedCash(0, 0)).toBe(0);
  });

  it('difference is counted minus expected, in cents', () => {
    expect(differenceCash(3400, 3400)).toBe(0);
    expect(differenceCash(3300, 3400)).toBe(-100);
    expect(differenceCash(3500, 3400)).toBe(100);
  });

  it('close snapshot: float 20 + cash 14 + card 10, counted 34 → difference 0', () => {
    expect(closeSnapshot(2000, [cash14, card10], 3400)).toEqual({
      cashTotal: 1400,
      cardTotal: 1000,
      transferTotal: 0,
      otherTotal: 0,
      expectedCash: 3400,
      differenceCash: 0,
    });
  });

  it('close snapshot: same drawer counted 33 → shortage of 1.00', () => {
    expect(closeSnapshot(2000, [cash14, card10], 3300).differenceCash).toBe(-100);
  });
});

describe('«Otro» y transferencias por cuenta (069 RN-5, RN-7)', () => {
  const agricola = {
    id: 'acc-agricola',
    bank: 'AGRICOLA',
    type: 'CHECKING',
    number: '0012345678',
  } as const;
  const bac = { id: 'acc-bac', bank: 'BAC', type: 'SAVINGS', number: '99887766' } as const;

  const transfer = (
    amount: number,
    bankAccount: AccountedPayment['bankAccount'],
  ): AccountedPayment => ({
    method: 'TRANSFER',
    amount,
    bankAccount,
  });
  const other = (amount: number): AccountedPayment => ({
    method: 'OTHER',
    amount,
    bankAccount: null,
  });

  // $20 a Agrícola, $15 a BAC, $5 «Otro: cheque» — el caso del criterio de aceptación.
  const shift = [transfer(2000, agricola), transfer(1500, bac), other(500)];

  it('«Otro» va a su propio total y no toca el efectivo esperado', () => {
    const totals = paymentTotals([{ method: 'CASH', amount: 1400 }, ...shift]);

    expect(totals).toEqual({ cashTotal: 1400, cardTotal: 0, transferTotal: 3500, otherTotal: 500 });
    expect(closeSnapshot(2000, shift, 2000)).toMatchObject({
      otherTotal: 500,
      transferTotal: 3500,
      expectedCash: 2000,
      differenceCash: 0,
    });
  });

  it('desglosa las transferencias por cuenta, y suman el total', () => {
    const lines = transferByAccount(shift);

    expect(lines).toEqual([
      { bankAccountId: 'acc-bac', label: 'BAC Credomatic · Ahorro · ···7766', total: 1500 },
      { bankAccountId: 'acc-agricola', label: 'Banco Agrícola · Corriente · ···5678', total: 2000 },
    ]);
    expect(lines.reduce((sum, line) => sum + line.total, 0)).toBe(3500);
  });

  it('junta dos transferencias a la misma cuenta en una fila', () => {
    expect(transferByAccount([transfer(1000, agricola), transfer(250, agricola)])).toEqual([
      { bankAccountId: 'acc-agricola', label: 'Banco Agrícola · Corriente · ···5678', total: 1250 },
    ]);
  });

  it('las transferencias anteriores a la 069 van en «Sin cuenta», al final', () => {
    expect(transferByAccount([transfer(700, null), transfer(2000, agricola)])).toEqual([
      { bankAccountId: 'acc-agricola', label: 'Banco Agrícola · Corriente · ···5678', total: 2000 },
      { bankAccountId: null, label: NO_ACCOUNT_LABEL, total: 700 },
    ]);
  });

  it('sin transferencias, el desglose va vacío', () => {
    expect(transferByAccount([other(500)])).toEqual([]);
  });
});
