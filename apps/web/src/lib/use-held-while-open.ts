'use client';

import { useRef } from 'react';

/**
 * El valor de cuando `open` era true. Si ahora está cerrado, el anterior.
 *
 * Radix deja el diálogo montado durante la animación de cierre. Si el padre
 * limpia la entidad en el mismo render que pone `open` en false, el saliente
 * pinta el alta vacía un instante. Esto conserva lo último hasta la próxima
 * apertura.
 */
export function holdWhileOpen<T>(held: T, value: T, open: boolean): T {
  return open ? value : held;
}

export function useHeldWhileOpen<T>(value: T, open: boolean): T {
  const held = useRef(value);
  held.current = holdWhileOpen(held.current, value, open);
  return held.current;
}
