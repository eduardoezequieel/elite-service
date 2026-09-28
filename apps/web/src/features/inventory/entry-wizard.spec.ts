import { createInventoryEntriesSchema } from '@elite/shared';

import {
  averageAfter,
  backStepOf,
  entriesDraft,
  entryTotalCents,
  stepIndex,
  unitCostOf,
  upsertLine,
} from './entry-wizard';

const SODA = '0b8a4a8e-4d2e-4f55-9d57-4a1d2b1c9e01';
const RAG = '1c9b5b9f-5e3f-4a66-8e68-5b2e3c2d0f12';

describe('los pasos de la entrada (091)', () => {
  it('son cinco, en orden', () => {
    expect(stepIndex('kind')).toBe(0);
    expect(stepIndex('review')).toBe(4);
  });

  it('«Atrás» vuelve un paso; editando desde Revisar, la cantidad vuelve a Revisar', () => {
    expect(backStepOf('kind', false)).toBeNull();
    expect(backStepOf('item', false)).toBe('kind');
    expect(backStepOf('quantity', false)).toBe('item');
    expect(backStepOf('quantity', true)).toBe('review');
    expect(backStepOf('cost', false)).toBe('quantity');
    expect(backStepOf('review', false)).toBeNull();
  });
});

describe('las líneas (091 RN-3)', () => {
  it('un artículo va una sola vez: elegirlo de nuevo reemplaza su línea en su lugar', () => {
    const lines = upsertLine(upsertLine([], { itemId: SODA, quantity: '5', unitCost: '' }), {
      itemId: RAG,
      quantity: '10',
      unitCost: '1.50',
    });

    expect(upsertLine(lines, { itemId: SODA, quantity: '6', unitCost: '0.70' })).toEqual([
      { itemId: SODA, quantity: '6', unitCost: '0.70' },
      { itemId: RAG, quantity: '10', unitCost: '1.50' },
    ]);
  });

  it('el costo vacío es «sin costo» y lo ilegible no es un costo', () => {
    expect(unitCostOf('')).toBeNull();
    expect(unitCostOf('0,75')).toBe(75);
    expect(unitCostOf('abc')).toBeUndefined();
  });

  it('el total suma solo lo que trae costo', () => {
    expect(
      entryTotalCents([
        { itemId: SODA, quantity: '5', unitCost: '0.70' },
        { itemId: RAG, quantity: '10', unitCost: '' },
      ]),
    ).toBe(350);
  });
});

describe('el costo promedio que va a quedar (065 RN-11)', () => {
  it('pondera por la existencia', () => {
    // 10 a $1.00 más 10 a $2.00 → $1.50.
    expect(averageAfter('10.000', '1.00', 10_000, 200)).toBe(150);
  });

  it('sin existencia manda el costo nuevo', () => {
    expect(averageAfter('0.000', '0.70', 5_000, 100)).toBe(100);
  });
});

describe('lo que va a POST /inventory/entries', () => {
  it('manda cantidad, costo si hay y la referencia una sola vez, y pasa el schema', () => {
    const draft = entriesDraft(
      [
        { itemId: SODA, quantity: '24', unitCost: '0.7' },
        { itemId: RAG, quantity: '10', unitCost: '' },
      ],
      ' Factura 4471 ',
    );

    expect(draft).toEqual({
      reference: 'Factura 4471',
      lines: [
        { itemId: SODA, quantity: '24.000', unitCost: '0.70' },
        { itemId: RAG, quantity: '10.000' },
      ],
    });
    expect(createInventoryEntriesSchema.safeParse(draft).success).toBe(true);
  });

  it('sin líneas no pasa el schema', () => {
    expect(createInventoryEntriesSchema.safeParse(entriesDraft([], '')).success).toBe(false);
  });
});
