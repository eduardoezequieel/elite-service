'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Lo que se está escribiendo en el campo de nota y contra qué versión del
 * servidor se empezó a escribir.
 */
export interface NoteDraft {
  value: string;
  /** La nota del servidor con la que se sincronizó por última vez. */
  base: string;
}

/**
 * La nota del lavado la tocan dos personas a la vez: quien lava desde la pista
 * y quien cobra desde el mostrador (041). El hilo en vivo trae la del otro
 * mientras la propia pantalla está abierta, y hay que decidir qué hacer con lo
 * que ya está escrito en el campo.
 *
 * La regla es la que no pierde trabajo de nadie:
 *
 * - Si el campo no se tocó, adopta la del servidor. Eso es el «tiempo real»:
 *   el mostrador ve enseguida lo que anotó la pista.
 * - Si el campo se tocó, **no se pisa**. Lo tecleado queda y el conflicto se le
 *   muestra a la persona, que decide.
 * - Si la del servidor ya es igual a lo tecleado —lo normal después de guardar—
 *   simplemente se sincroniza, sin conflicto.
 */
export function syncNote(draft: NoteDraft, remote: string): NoteDraft {
  if (draft.base === remote) return draft;
  if (draft.value === remote || draft.value === draft.base) return { value: remote, base: remote };

  return draft;
}

/** La nota ajena que no se aplicó porque había algo escrito, o `null`. */
export function conflictOf(draft: NoteDraft, remote: string): string | null {
  return draft.base === remote ? null : remote;
}

/**
 * El campo de nota de un lavado, sincronizado con lo que llega por el hilo.
 *
 * `remote` es `ticket.notes`: lo que diga el ticket **fresco**. Si la pantalla
 * guarda el ticket en un estado propio en vez de releerlo, acá no llega nada y
 * el campo se queda viejo aunque el hilo funcione.
 */
export function useTicketNote(remote: string | null): {
  value: string;
  setValue: (next: string) => void;
  /** La nota que escribió el otro y no se aplicó. `null` si no hay conflicto. */
  conflict: string | null;
  /** Descartar lo tecleado y quedarse con la del otro. */
  accept: () => void;
  /** Volver a empezar desde la del servidor (al cerrar un diálogo). */
  reset: () => void;
} {
  const text = remote ?? '';
  const [draft, setDraft] = useState<NoteDraft>({ value: text, base: text });
  const latest = useRef(text);

  latest.current = text;

  useEffect(() => {
    setDraft((current) => syncNote(current, text));
  }, [text]);

  return {
    value: draft.value,
    setValue: (next) => setDraft((current) => ({ ...current, value: next })),
    conflict: conflictOf(draft, text),
    accept: () => setDraft({ value: latest.current, base: latest.current }),
    reset: () => setDraft({ value: latest.current, base: latest.current }),
  };
}
