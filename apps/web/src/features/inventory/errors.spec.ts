import { availableFrom, inventoryErrorView, validationFieldErrors } from './errors';

describe('errores del inventario (065)', () => {
  it('sin existencia dice «Hay N» con la unidad y marca la cantidad', () => {
    const view = inventoryErrorView(
      {
        code: 'INSUFFICIENT_STOCK',
        message: 'Stock insuficiente',
        details: { itemId: 'i-1', available: '1.000' },
      },
      'unidad',
    );

    expect(view.field).toBe('quantity');
    expect(view.message).toBe('No alcanza. Hay 1 unidad.');
  });

  it('sin detalle no inventa una cifra', () => {
    expect(inventoryErrorView({ code: 'INSUFFICIENT_STOCK', message: 'x' }).message).toBe(
      'No alcanza la existencia para eso.',
    );
  });

  it('lee `available` como cadena o como número', () => {
    expect(availableFrom({ available: '2.500' })).toBe('2.500');
    expect(availableFrom({ available: 3 })).toBe('3.000');
    expect(availableFrom(null)).toBeNull();
  });

  it('pega cada código a su campo', () => {
    expect(inventoryErrorView({ code: 'BARCODE_TAKEN', message: 'x' }).field).toBe('barcode');
    expect(inventoryErrorView({ code: 'SUPPLY_HAS_PRICE', message: 'x' }).field).toBe('price');
    expect(inventoryErrorView({ code: 'CATEGORY_NAME_TAKEN', message: 'x' }).field).toBe('name');
    expect(inventoryErrorView({ code: 'EMPLOYEE_NOT_FOUND', message: 'x' }).field).toBe(
      'employeeId',
    );
    expect(inventoryErrorView({ code: 'ITEM_INACTIVE', message: 'x' }).field).toBeUndefined();
  });

  it('lo que no conoce pasa con el mensaje del API', () => {
    expect(inventoryErrorView({ code: 'FORBIDDEN', message: 'No tenés permiso.' })).toEqual({
      message: 'No tenés permiso.',
    });
  });

  it('baja los detalles de validación solo a los campos que conoce', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
      details: { reason: 'Escribí el motivo del ajuste.', other: 'nada', quantity: ['Mal'] },
    };

    expect(validationFieldErrors(error, ['reason', 'quantity'] as const)).toEqual({
      reason: 'Escribí el motivo del ajuste.',
      quantity: 'Mal',
    });
    expect(validationFieldErrors({ code: 'CONFLICT', message: 'x' }, ['reason'] as const)).toEqual(
      {},
    );
  });
});
