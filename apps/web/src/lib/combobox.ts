/**
 * Una opción del combobox: valor estable, etiqueta visible, dato extra opcional.
 *
 * `hint` es una segunda línea bajo la etiqueta —la fila pasa a ser alta y la
 * etiqueta ya no se corta—. `kind: 'action'` es una fila que no elige de la
 * lista sino que hace algo («crear nuevo»): no lleva tilde de elegida y el
 * filtro local nunca la descarta (047).
 */
export type ComboboxOption = {
  value: string;
  label: string;
  meta?: string;
  hint?: string;
  kind?: 'action';
};

/** Sin acentos y en minúscula: «josé» encuentra a «Jose» y al revés. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Filtra por etiqueta o meta. Cadena vacía = la lista entera. */
export function filterOptions(options: readonly ComboboxOption[], query: string): ComboboxOption[] {
  const needle = foldText(query.trim());
  if (needle === '') return options.slice();

  return options.filter((option) => {
    if (option.kind === 'action') return true;
    if (foldText(option.label).includes(needle)) return true;
    return typeof option.meta === 'string' && foldText(option.meta).includes(needle);
  });
}

const TYPEAHEAD_GAP_MS = 700;

/** Acumula letras del typeahead: si pasó de 700 ms, empieza de nuevo. */
export function nextTypeaheadBuffer(
  previous: string,
  previousAt: number,
  char: string,
  now: number,
): { buffer: string; at: number } {
  const buffer = now - previousAt > TYPEAHEAD_GAP_MS ? char : `${previous}${char}`;
  return { buffer, at: now };
}

/**
 * Índice al que salta el typeahead. Repetir la misma letra recorre las que
 * empiezan con ella; si no, busca el prefijo acumulado.
 */
export function typeaheadIndex(
  options: readonly ComboboxOption[],
  buffer: string,
  active: number,
): number {
  const needle = foldText(buffer);
  if (options.length === 0 || needle === '') return -1;

  const repeated = [...needle].every((letter) => letter === needle[0]);

  if (repeated && needle.length > 1) {
    const from = active < 0 ? 0 : active;
    for (let step = 1; step <= options.length; step += 1) {
      const index = (from + step) % options.length;
      if (foldText(options[index].label).startsWith(needle[0])) return index;
    }
  }

  return options.findIndex((option) => foldText(option.label).startsWith(needle));
}

export const COMBOBOX_GAP = 8;
export const COMBOBOX_EDGE = 12;
export const COMBOBOX_MIN_LIST = 64;

export type ComboboxBox = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type ComboboxViewport = {
  width: number;
  height: number;
};

export type ComboboxPlacement = {
  top: number;
  left: number;
  width: number;
  listMaxHeight: number | null;
};

/**
 * Coloca el panel: 8px de gap, del ancho de la caja o del `anchor` que se le
 * pase —el bloque entero, cuando la caja sola es demasiado angosta para leer la
 * opción (047)—. Abre abajo; si no cabe, se da vuelta; si no cabe de ningún
 * lado, gana el lado con más aire y el listado scrollea adentro. A lo ancho
 * nunca se sale de la pantalla: se recorta contra los bordes.
 */
export function placeComboboxPanel(
  trigger: ComboboxBox,
  panelHeight: number,
  listHeight: number,
  viewport: ComboboxViewport,
  anchor?: Pick<ComboboxBox, 'left' | 'width'>,
): ComboboxPlacement {
  const from = anchor ?? trigger;
  const width = Math.min(from.width, Math.max(viewport.width - COMBOBOX_EDGE * 2, 0));
  const left = Math.max(Math.min(from.left, viewport.width - COMBOBOX_EDGE - width), COMBOBOX_EDGE);
  const chrome = Math.max(panelHeight - listHeight, 0);
  const below = viewport.height - trigger.bottom - COMBOBOX_GAP - COMBOBOX_EDGE;
  const above = trigger.top - COMBOBOX_GAP - COMBOBOX_EDGE;

  if (panelHeight <= below) {
    return { top: trigger.bottom + COMBOBOX_GAP, left, width, listMaxHeight: null };
  }

  if (panelHeight <= above) {
    return { top: trigger.top - COMBOBOX_GAP - panelHeight, left, width, listMaxHeight: null };
  }

  const room = Math.max(above, below, 0);
  const listMaxHeight = Math.max(room - chrome, COMBOBOX_MIN_LIST);
  const nextHeight = chrome + listMaxHeight;
  const top =
    above > below ? trigger.top - COMBOBOX_GAP - nextHeight : trigger.bottom + COMBOBOX_GAP;

  return { top: Math.max(top, COMBOBOX_EDGE), left, width, listMaxHeight };
}
