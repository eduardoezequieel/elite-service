'use client';

import { useEffect } from 'react';

/**
 * Cuánto tapa el teclado del teléfono el pie de la pantalla.
 *
 * iOS no achica el layout viewport al abrir el teclado: lo que está `fixed` a
 * `bottom: 0` queda debajo de él. El visual viewport sí se achica, así que la
 * diferencia es el teclado (más la barra de Safari que se le pega encima).
 */
export function keyboardInset(
  layoutHeight: number,
  visualHeight: number,
  visualTop: number,
): number {
  return Math.max(0, Math.round(layoutHeight - visualHeight - visualTop));
}

/** Menos que esto es la barra de Safari moviéndose, no un teclado. */
const KEYBOARD_MIN = 120;

export function isKeyboardOpen(inset: number): boolean {
  return inset >= KEYBOARD_MIN;
}

let users = 0;
let detach: (() => void) | null = null;

function attach(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement;
  const update = () => {
    const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
    const open = isKeyboardOpen(inset);
    const wasOpen = root.hasAttribute('data-keyboard');
    root.style.setProperty('--keyboard-inset', `${inset}px`);
    root.style.setProperty('--visual-height', `${Math.round(vv.height)}px`);
    root.toggleAttribute('data-keyboard', open);
    // Al abrir, el campo con foco puede quedar fuera del cuerpo ya achicado.
    if (open && !wasOpen && document.activeElement instanceof HTMLElement) {
      const field = document.activeElement;
      requestAnimationFrame(() => field.scrollIntoView({ block: 'nearest' }));
    }
  };
  update();
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    root.style.removeProperty('--keyboard-inset');
    root.style.removeProperty('--visual-height');
    root.removeAttribute('data-keyboard');
  };
}

/**
 * Publica `--keyboard-inset`, `--visual-height` y `data-keyboard` en `<html>` mientras haya
 * alguien montado que lo use. Varios diálogos abiertos comparten una sola
 * suscripción.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    if (users++ === 0) detach = attach();
    return () => {
      if (--users === 0) {
        detach?.();
        detach = null;
      }
    };
  }, []);
}
