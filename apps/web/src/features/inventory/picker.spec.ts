import {
  edgeEnabledIndex,
  enterPickIndex,
  isOutOfStock,
  nextEnabledIndex,
  radioKeyIndex,
} from './picker';

describe('selectores en línea del inventario (072)', () => {
  it('sin existencia es 0 o menos', () => {
    expect(isOutOfStock('0.000')).toBe(true);
    expect(isOutOfStock('-1.500')).toBe(true);
    expect(isOutOfStock('0.001')).toBe(false);
    expect(isOutOfStock('4.000')).toBe(false);
    expect(isOutOfStock('no es cifra')).toBe(false);
  });

  it('las flechas saltan las opciones deshabilitadas y dan la vuelta', () => {
    const disabled = [false, true, false, true];

    expect(nextEnabledIndex(disabled, -1, 1)).toBe(0);
    expect(nextEnabledIndex(disabled, -1, -1)).toBe(2);
    expect(nextEnabledIndex(disabled, 0, 1)).toBe(2);
    expect(nextEnabledIndex(disabled, 2, 1)).toBe(0);
    expect(nextEnabledIndex(disabled, 0, -1)).toBe(2);
  });

  it('sin opciones habilitadas no hay activa', () => {
    expect(nextEnabledIndex([], -1, 1)).toBe(-1);
    expect(nextEnabledIndex([true, true], -1, 1)).toBe(-1);
    expect(edgeEnabledIndex([true, true], 'first')).toBe(-1);
  });

  it('las puntas son la primera y la última habilitadas', () => {
    expect(edgeEnabledIndex([true, false, false, true], 'first')).toBe(1);
    expect(edgeEnabledIndex([true, false, false, true], 'last')).toBe(2);
  });

  it('Enter elige la activa, o la única que hay si la lista ya se asentó', () => {
    expect(enterPickIndex([false, false], 1, true)).toBe(1);
    expect(enterPickIndex([false, true], 1, true)).toBe(-1);
    expect(enterPickIndex([true, false], -1, true)).toBe(1);
    expect(enterPickIndex([true, false], -1, false)).toBe(-1);
    expect(enterPickIndex([false, false], -1, true)).toBe(-1);
    expect(enterPickIndex([], -1, true)).toBe(-1);
  });

  it('la grilla de radios va en orden de lectura, con Home y End', () => {
    expect(radioKeyIndex('ArrowRight', 0, 3)).toBe(1);
    expect(radioKeyIndex('ArrowDown', 2, 3)).toBe(0);
    expect(radioKeyIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(radioKeyIndex('ArrowUp', -1, 3)).toBe(2);
    expect(radioKeyIndex('Home', 2, 3)).toBe(0);
    expect(radioKeyIndex('End', 0, 3)).toBe(2);
    expect(radioKeyIndex('a', 0, 3)).toBeNull();
    expect(radioKeyIndex('ArrowRight', -1, 0)).toBeNull();
  });
});
