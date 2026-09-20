import { holdWhileOpen } from './use-held-while-open';

describe('holdWhileOpen', () => {
  it('entrega el valor nuevo mientras está abierto', () => {
    expect(holdWhileOpen('juan', 'carlos', true)).toBe('carlos');
    expect(holdWhileOpen(null, 'juan', true)).toBe('juan');
    expect(holdWhileOpen('juan', null, true)).toBeNull();
  });

  it('conserva el valor anterior al cerrar, aunque el padre lo limpie', () => {
    expect(holdWhileOpen('juan', null, false)).toBe('juan');
    expect(holdWhileOpen(null, 'juan', false)).toBeNull();
  });
});
