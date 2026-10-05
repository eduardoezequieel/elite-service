import {
  afterLines,
  afterPayment,
  afterVoid,
  rejectLineVoid,
  rejectTabPayment,
  tabLineTotal,
  tabNumberQuery,
  type TabFigures,
} from './tab';

const open = (total: number, paid: number): TabFigures => ({
  total,
  paid,
  balance: total - paid,
  closed: false,
});

describe('tab rules (106)', () => {
  it('values a line like a counter sale, rounding half a cent up', () => {
    expect(tabLineTotal(125, 2000)).toBe(250);
    expect(tabLineTotal(333, 500)).toBe(167);
  });

  it('adds lines to total and balance without closing', () => {
    expect(afterLines(open(300, 100), 250)).toEqual({
      total: 550,
      paid: 100,
      balance: 450,
      closes: false,
    });
  });

  describe('voiding a line (RN-5)', () => {
    it('allows it while the balance stays at or above zero', () => {
      expect(rejectLineVoid(open(500, 300), { total: 200, voided: false })).toBeNull();
    });

    it('rejects a closed tab, a voided line and a balance below what was paid', () => {
      expect(
        rejectLineVoid({ ...open(500, 500), closed: true }, { total: 100, voided: false }),
      ).toEqual({ reason: 'TAB_CLOSED' });
      expect(rejectLineVoid(open(500, 0), { total: 100, voided: true })).toEqual({
        reason: 'LINE_ALREADY_VOIDED',
      });
      expect(rejectLineVoid(open(500, 300), { total: 250, voided: false })).toEqual({
        reason: 'LINE_BELOW_PAID',
        balance: 200,
        lineTotal: 250,
      });
    });

    it('closes the tab when the void leaves the balance at zero (RN-8)', () => {
      expect(afterVoid(open(500, 300), 200)).toEqual({
        total: 300,
        paid: 300,
        balance: 0,
        closes: true,
      });
      expect(afterVoid(open(500, 0), 100).closes).toBe(false);
    });
  });

  describe('a payment (RN-7)', () => {
    it('accepts an amount between one cent and the balance', () => {
      expect(rejectTabPayment(open(500, 0), 1)).toBeNull();
      expect(rejectTabPayment(open(500, 0), 500)).toBeNull();
    });

    it('rejects zero, more than the balance and a closed tab', () => {
      expect(rejectTabPayment(open(500, 0), 0)).toEqual({ reason: 'PAYMENT_NOT_POSITIVE' });
      expect(rejectTabPayment(open(500, 100), 401)).toEqual({
        reason: 'PAYMENT_OVER_BALANCE',
        balance: 400,
      });
      expect(rejectTabPayment({ ...open(500, 500), closed: true }, 1)).toEqual({
        reason: 'TAB_CLOSED',
      });
    });

    it('closes the tab only when the balance reaches zero (RN-8)', () => {
      expect(afterPayment(open(500, 0), 300)).toEqual({
        total: 500,
        paid: 300,
        balance: 200,
        closes: false,
      });
      expect(afterPayment(open(500, 300), 200).closes).toBe(true);
    });
  });

  it('reads a tab number from C-0012, c-12 or 12', () => {
    expect(tabNumberQuery('C-0012', 'C')).toBe('12');
    expect(tabNumberQuery('c12', 'C')).toBe('12');
    expect(tabNumberQuery(' 0012 ', 'C')).toBe('12');
    expect(tabNumberQuery('Juan', 'C')).toBeNull();
  });
});
