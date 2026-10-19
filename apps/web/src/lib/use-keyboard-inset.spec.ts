import { isKeyboardOpen, keyboardInset } from './use-keyboard-inset';

describe('keyboardInset', () => {
  it('es cero sin teclado', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0);
  });

  it('es lo que el teclado le quita al visual viewport', () => {
    expect(keyboardInset(844, 508, 0)).toBe(336);
  });

  it('descuenta lo que Safari desplazó la vista', () => {
    expect(keyboardInset(844, 508, 120)).toBe(216);
  });

  it('nunca es negativo', () => {
    expect(keyboardInset(700, 844, 0)).toBe(0);
  });
});

describe('isKeyboardOpen', () => {
  it('no confunde la barra de Safari con un teclado', () => {
    expect(isKeyboardOpen(0)).toBe(false);
    expect(isKeyboardOpen(80)).toBe(false);
  });

  it('reconoce el teclado', () => {
    expect(isKeyboardOpen(336)).toBe(true);
  });
});
