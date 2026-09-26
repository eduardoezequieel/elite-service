/**
 * El paginado en cliente de `<DataTable pageSize>` (spec 067), sin React.
 *
 * `page` empieza en 0. Una página fuera de rango —la lista se achicó mientras
 * se miraba la última— se lleva a la última que existe.
 */
export interface PageWindow {
  page: number;
  pages: number;
  /** Índice de la primera fila de la página. */
  start: number;
  /** Índice siguiente a la última fila de la página. */
  end: number;
}

export function pageWindow(total: number, pageSize: number, page: number): PageWindow {
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const start = current * size;

  return { page: current, pages, start, end: Math.min(start + size, total) };
}

/** `1–10 de 69`. */
export function pageLabel(window: PageWindow, total: number): string {
  return `${total === 0 ? 0 : window.start + 1}–${window.end} de ${total}`;
}
