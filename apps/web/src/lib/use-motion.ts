'use client';

import { useState } from 'react';

import { arrivedKeys, changeMark, countChange } from './motion';

/**
 * Las filas que llegaron en el último cambio de la lista (spec 087).
 *
 * El estado se ajusta durante el render, no en un efecto: así la fila nueva ya
 * se pinta con su marca en el primer cuadro, y el doble render del modo
 * estricto no la pierde —un `useRef` escrito en el render sí la perdería—.
 */
export function useArrivedKeys(keys: readonly string[]): ReadonlySet<string> {
  const signature = keys.join('\n');
  const [state, setState] = useState(() => ({
    signature,
    keys,
    arrived: arrivedKeys(keys, keys),
  }));

  if (state.signature !== signature) {
    const next = { signature, keys, arrived: arrivedKeys(state.keys, keys) };
    setState(next);
    return next.arrived;
  }

  return state.arrived;
}

/**
 * El atributo `data-changed` de algo que cambió después de montarse: la cifra
 * de una tarjeta, el estado de un sello, el contador de la campana.
 */
export function useChangeMark<T>(
  value: T,
  isChange?: (previous: T, next: T) => boolean,
): 'odd' | 'even' | undefined {
  const [state, setState] = useState(() => ({ value, count: 0 }));
  const next = countChange(state, value, isChange);

  if (next !== state) setState(next);

  return changeMark(next.count);
}
