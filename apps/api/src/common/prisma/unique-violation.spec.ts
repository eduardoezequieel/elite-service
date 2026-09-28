import { Prisma } from '@prisma/client';

import { uniqueViolationOn } from './unique-violation';

function p2002(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

/** Lo que deja `@prisma/adapter-pg` en `meta` (Prisma 7). */
function adapterClash(
  constraint: Record<string, unknown>,
  table?: string,
): Record<string, unknown> {
  return {
    driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint, table } },
  };
}

describe('uniqueViolationOn (080)', () => {
  it('lee `meta.target` como arreglo de columnas', () => {
    const error = p2002({ target: ['kind', 'name'] });

    expect(uniqueViolationOn(error, 'name')).toBe(true);
    expect(uniqueViolationOn(error, 'kind')).toBe(true);
    expect(uniqueViolationOn(error, 'code')).toBe(false);
  });

  it('un choque en `barcode` no es un choque en `code`', () => {
    expect(uniqueViolationOn(p2002({ target: ['barcode'] }), 'code')).toBe(false);
    expect(
      uniqueViolationOn(
        p2002(adapterClash({ index: 'inventory_items_barcode_key' }, 'inventory_items')),
        'code',
      ),
    ).toBe(false);
  });

  it('lee las columnas que deja el adaptador', () => {
    expect(uniqueViolationOn(p2002(adapterClash({ fields: ['plate'] })), 'plate')).toBe(true);
  });

  it('parte el nombre del indice cuando el adaptador solo trae eso', () => {
    const error = p2002(
      adapterClash({ index: 'inventory_categories_kind_name_key' }, 'inventory_categories'),
    );

    expect(uniqueViolationOn(error, 'name')).toBe(true);
    expect(uniqueViolationOn(error, 'categories')).toBe(false);
    expect(
      uniqueViolationOn(
        p2002(
          adapterClash(
            { index: 'inventory_movements_reversesMovementId_key' },
            'inventory_movements',
          ),
        ),
        'reversesMovementId',
      ),
    ).toBe(true);
  });

  it('sin tabla, igual encuentra la columna en el nombre del indice', () => {
    expect(uniqueViolationOn(p2002(adapterClash({ index: 'vehicles_plate_key' })), 'plate')).toBe(
      true,
    );
  });

  it('otro error, u otro codigo, no es un choque', () => {
    expect(uniqueViolationOn(new Error('plate'), 'plate')).toBe(false);
    expect(
      uniqueViolationOn(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { target: ['plate'] },
        }),
        'plate',
      ),
    ).toBe(false);
  });
});
