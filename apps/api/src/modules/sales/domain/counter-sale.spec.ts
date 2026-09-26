import {
  isSaleVoidable,
  needsPriceAuthorization,
  priceSaleLines,
  saleLineTotal,
  snapshotSaleLine,
  type SaleCatalogItem,
} from './counter-sale';

const wax: SaleCatalogItem = {
  id: 'wax',
  code: 'INV-0001',
  name: 'Cera en pasta',
  kind: 'PRODUCT',
  isActive: true,
  price: 300,
  taxRate: '0.1300',
};

describe('saleLineTotal', () => {
  it('multiplies whole quantities exactly', () => {
    expect(saleLineTotal(300, 2000)).toBe(600);
  });

  it('handles fractional quantities in integers', () => {
    expect(saleLineTotal(150, 2500)).toBe(375);
  });

  it('rounds half a cent up', () => {
    // 3.33 × 1.5 = 4.995
    expect(saleLineTotal(333, 1500)).toBe(500);
    // 3.33 × 0.001 = 0.00333
    expect(saleLineTotal(333, 1)).toBe(0);
  });
});

describe('priceSaleLines', () => {
  it('defaults to the item price and computes totals', () => {
    const result = priceSaleLines(
      [{ inventoryItemId: 'wax', quantity: 2000, unitPrice: null }],
      [wax],
    );

    expect(result).toEqual({
      ok: true,
      lines: [
        {
          item: wax,
          quantity: 2000,
          catalogPrice: 300,
          unitPrice: 300,
          total: 600,
          discounted: false,
        },
      ],
    });
  });

  it('flags a lower price as discounted, and zero is allowed', () => {
    const result = priceSaleLines(
      [{ inventoryItemId: 'wax', quantity: 1000, unitPrice: 0 }],
      [wax],
    );

    expect(result.ok).toBe(true);
    expect(result.ok && needsPriceAuthorization(result.lines)).toBe(true);
  });

  it('does not ask for authorization at catalog price', () => {
    const result = priceSaleLines(
      [{ inventoryItemId: 'wax', quantity: 1000, unitPrice: 300 }],
      [wax],
    );

    expect(result.ok && needsPriceAuthorization(result.lines)).toBe(false);
  });

  it('rejects a price above the item', () => {
    const result = priceSaleLines(
      [{ inventoryItemId: 'wax', quantity: 1000, unitPrice: 301 }],
      [wax],
    );

    expect(result).toEqual({
      ok: false,
      rejection: { reason: 'ABOVE_CATALOG', itemId: 'wax', catalogPrice: 300 },
    });
  });

  it('rejects unknown, inactive and supply items, inactive first', () => {
    const line = { inventoryItemId: 'wax', quantity: 1000, unitPrice: null };

    expect(priceSaleLines([line], [])).toEqual({
      ok: false,
      rejection: { reason: 'NOT_FOUND', itemId: 'wax' },
    });
    expect(priceSaleLines([line], [{ ...wax, kind: 'SUPPLY' }])).toEqual({
      ok: false,
      rejection: { reason: 'NOT_SELLABLE', itemId: 'wax' },
    });
    expect(priceSaleLines([line], [{ ...wax, kind: 'SUPPLY', isActive: false }])).toEqual({
      ok: false,
      rejection: { reason: 'INACTIVE', itemId: 'wax' },
    });
  });
});

describe('isSaleVoidable (RN-22)', () => {
  const open = { isOpen: true };
  const closed = { isOpen: false };

  it('a paid sale whose payments are all in the open shift can be voided', () => {
    expect(isSaleVoidable('PAID', [open, open])).toBe(true);
  });

  it('not once the shift closed, not when void, not without payments', () => {
    expect(isSaleVoidable('PAID', [open, closed])).toBe(false);
    expect(isSaleVoidable('VOID', [open])).toBe(false);
    expect(isSaleVoidable('PAID', [])).toBe(false);
  });
});

describe('snapshotSaleLine (066)', () => {
  const priced = (unitPrice: number | null) => {
    const result = priceSaleLines([{ inventoryItemId: 'wax', quantity: 2000, unitPrice }], [wax]);

    if (!result.ok) throw new Error('unexpected rejection');

    return result.lines[0];
  };

  it('signs only a lowered line', () => {
    const signer = { userId: 'u-boss', reason: 'Cliente frecuente' };

    expect(snapshotSaleLine(priced(250), signer)).toMatchObject({
      unitPrice: 250,
      catalogPrice: 300,
      priceAuthorizedByUserId: 'u-boss',
      priceReason: 'Cliente frecuente',
    });
    expect(snapshotSaleLine(priced(null), signer)).toMatchObject({
      unitPrice: 300,
      priceAuthorizedByUserId: null,
      priceReason: null,
    });
  });
});
