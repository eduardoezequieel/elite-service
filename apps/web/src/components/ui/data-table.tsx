'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { currentOrigin, withBackTo } from '@/components/app-shell/back-link';
import { useArrivedKeys } from '@/lib/use-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { pageLabel, pageWindow } from '@/components/ui/data-table-page';
import { EmptyState } from '@/components/ui/empty-state';
import { HelpTip } from '@/components/ui/help-tip';
import { Reference } from '@/components/ui/reference';
import { ListSkeleton } from '@/components/ui/skeleton';

/**
 * La lista del sistema: **una sola lista para todas las pantallas**.
 *
 * Las columnas se declaran una vez y de esa misma declaración salen las dos
 * formas:
 *
 * - **Escritorio (≥900px):** una lámina única con radio 12, filete `--line-soft`,
 *   sombra única, cabecera con fondo `--surface-2` y filete `--line`, y filas en
 *   tabla HTML nativa con separador tenue y hover `--surface-2`.
 * - **Táctil (<900px):** la misma tarjeta apilada según `stack`, con la
 *   referencia arriba, el dato que nombra la fila debajo, el resto rotulado y
 *   las acciones al pie a todo el ancho.
 *
 * Lo que la lista pone sola, y ninguna pantalla repite:
 *
 * - La primera columna es siempre el número de referencia.
 * - El estado de la lista —cargando, vacío, fallo— es una sola línea con el
 *   mismo texto y el mismo color en todas partes.
 * - Las acciones de fila van siempre visibles: en la bahía no hay `hover`.
 *
 * ```tsx
 * <DataTable
 *   rows={employees}
 *   rowKey={(employee) => employee.id}
 *   emptyTitle="Todavía no hay empleados"
 *   emptyMessage="Cuando crees el primero va a aparecer en esta lista."
 *   emptyAction={<Button>Nuevo empleado</Button>}
 *   isLoading={query.isPending}
 *   errorMessage={query.error?.message ?? null}
 *   columns={[
 *     { key: 'name', header: 'Nombre', stack: 'title', cell: (e) => e.fullName },
 *     { key: 'status', header: 'Estado', stack: 'aside', cell: (e) => <Stamp … /> },
 *   ]}
 * />
 * ```
 */

/**
 * Dónde cae la columna cuando la tarjeta se apila (<900px).
 *
 * - `title` — el dato que nombra la fila (la placa, el nombre). Va suelto, sin
 *   rótulo: no hace falta decir «Nombre» encima de un nombre.
 * - `aside` — el dato corto que acompaña a la referencia arriba a la derecha.
 *   Es el sitio del chip de estado.
 * - `field` — el resto: baja rotulado, rótulo a la izquierda y valor a la
 *   derecha. Es lo que se asume si no se dice nada.
 * - `actions` — los verbos de la fila, al pie de la tarjeta.
 */
export type DataTableStack = 'title' | 'aside' | 'field' | 'actions';

export interface DataTableColumn<Row> {
  /** Clave estable de la columna. No se muestra. */
  key: string;
  /** Cabecera en escritorio y rótulo en la tarjeta apilada. */
  header: string;
  /** El contenido de la celda. */
  cell: (row: Row, index: number) => React.ReactNode;
  /** Números y dinero a la derecha, con cifras tabulares. */
  align?: 'left' | 'right';
  /** Dónde cae al apilarse. Por defecto `field`. */
  stack?: DataTableStack;
  /** Clases de la celda: `whitespace-normal` para texto largo, … */
  className?: string;
  /** Clases solo de la cabecera, cuando difieren de las de la celda. */
  headerClassName?: string;
  /**
   * Qué significa la columna (spec 067): icono de ayuda al lado de la cabecera
   * en escritorio y del rótulo en la tarjeta apilada.
   */
  help?: string;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** Clave estable de la fila. */
  rowKey: (row: Row) => string;
  /**
   * El número de referencia de la fila. Por defecto la posición en la lista;
   * si el objeto tiene folio propio, se pasa el suyo — es el mismo número en
   * todas las pantallas donde aparece.
   */
  reference?: (row: Row, index: number) => number;
  /** Cómo se llama el vacío. Por defecto «Nada por aquí todavía». */
  emptyTitle?: string;
  /** Qué va a aparecer cuando haya algo. Sin ilustraciones. */
  emptyMessage: string;
  /** El botón que llena la lista, si el usuario puede. */
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  /** Mensaje de un fallo al pedir la lista, o `null`. */
  errorMessage?: string | null;
  /** Ruta a la que navega la fila al hacer clic (opcional). */
  rowHref?: (row: Row) => string;
  /** Acción al hacer clic en la fila o tarjeta (opcional). */
  onRowClick?: (row: Row) => void;
  /**
   * Paginado en cliente (spec 067): de a cuántas filas se muestra. Sin esto,
   * todas. Vuelve a la primera página cuando cambia `rows`.
   */
  pageSize?: number;
  /**
   * Lo que la fila abre debajo de sí (091): el detalle de un consumo, la
   * entrada rápida de un artículo. `null` o `undefined` es fila cerrada. En la
   * tabla es una fila a lo ancho; en la tarjeta apilada, un bloque al pie.
   */
  renderExpanded?: (row: Row, index: number) => React.ReactNode;
  className?: string;
}

/** El texto de carga es uno solo en todo el sistema. */
/** Lo que anuncia el lector de pantalla; a la vista van los esqueletos (067). */
const LOADING_LABEL = 'Cargando la lista';

/**
 * El paso de la fila en la cascada de entrada (088): después de la cabecera y
 * las tarjetas de cifra, que ocupan los primeros cuatro. `globals.css` le pone
 * el tope.
 */
const FIRST_ROW_STEP = 4;

function enterStep(pageIndex: number): React.CSSProperties {
  return { '--enter-step': FIRST_ROW_STEP + pageIndex } as React.CSSProperties;
}

/** El título del vacío cuando la pantalla no dice otro. */
const DEFAULT_EMPTY_TITLE = 'Nada por aquí todavía';

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  reference = (_row, index) => index + 1,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyMessage,
  emptyAction,
  isLoading = false,
  errorMessage = null,
  pageSize,
  renderExpanded,
  className,
}: DataTableProps<Row>) {
  const router = useRouter();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [page, setPage] = React.useState(0);

  // Otra lista —otro empleado, otro rango— arranca en su primera página.
  React.useEffect(() => setPage(0), [rows]);

  const pages =
    pageSize !== undefined && rows.length > pageSize
      ? pageWindow(rows.length, pageSize, page)
      : null;
  const visibleRows = pages === null ? rows : rows.slice(pages.start, pages.end);
  // La referencia y las celdas reciben la posición en la lista entera, no en la página.
  const offset = pages === null ? 0 : pages.start;
  // Qué fila llegó recién (088): destella una vez. Entrar lo hace CSS solo.
  const arrived = useArrivedKeys(visibleRows.map(rowKey));

  const goToPage = (next: number) => {
    setPage(next);
    rootRef.current?.scrollIntoView({ block: 'nearest' });
  };
  // Un fallo manda sobre todo lo demás: mejor decir que la lista no cargó que
  // dejar a la vista datos viejos como si fueran los de ahora.
  const state: 'rows' | 'loading' | 'empty' | 'error' =
    errorMessage !== null ? 'error' : rows.length > 0 ? 'rows' : isLoading ? 'loading' : 'empty';

  const isClickable = Boolean(rowHref || onRowClick);

  /**
   * El destino de la fila, anotando de dónde sale (spec 056): la ficha que se
   * abre desde acá tiene que saber volver a esta lista —con sus filtros—, y no
   * al padre de su ruta. Se resuelve en el manejador, no en el render, porque
   * el origen incluye la query que la pantalla escribe en `window.location`.
   */
  const hrefFor = (href: string) => withBackTo(href, currentOrigin());

  const handleRowClick = (row: Row) => (event: React.MouseEvent<HTMLElement>) => {
    if (!isClickable) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    if (rowHref) {
      // Una pestaña nueva no tiene de dónde volver: va sin el origen.
      if (event.metaKey || event.ctrlKey) {
        window.open(rowHref(row), '_blank');
        return;
      }
      router.push(hrefFor(rowHref(row)));
    } else if (onRowClick) {
      onRowClick(row);
    }
  };

  const handleRowKeyDown = (row: Row) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (!isClickable) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    event.preventDefault();
    if (rowHref) {
      if (event.metaKey || event.ctrlKey) {
        window.open(rowHref(row), '_blank');
        return;
      }
      router.push(hrefFor(rowHref(row)));
    } else if (onRowClick) {
      onRowClick(row);
    }
  };

  const pick = (stack: DataTableStack) =>
    columns.filter((column) => (column.stack ?? 'field') === stack);

  const titles = pick('title');
  const asides = pick('aside');
  const fields = pick('field');
  const actions = pick('actions');

  return (
    <div ref={rootRef} className={cn('flex flex-col', className)}>
      {state === 'rows' ? (
        <>
          {/* Escritorio (≥1100px): la tabla unificada. Bajo eso, tarjetas. */}
          <div className="border-line-soft bg-surface hidden overflow-hidden rounded-row border min-table:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-surface-2">
                  <tr className="border-line border-b">
                    <th
                      scope="col"
                      className="text-text-faint h-10 w-(--ref-col-w) px-4 text-left text-label font-semibold whitespace-nowrap"
                    >
                      Ref.
                    </th>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={cn(
                          // Un rótulo no se parte en renglones: «Lavado o venta» en tres líneas
                          // no se lee. La columna que quiera partir lo pide con `headerClassName`.
                          'text-text-faint h-10 px-4 text-label font-semibold whitespace-nowrap',
                          column.align === 'right' || column.stack === 'actions'
                            ? 'text-right'
                            : 'text-left',
                          column.headerClassName,
                        )}
                      >
                        {column.help === undefined ? (
                          column.header
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5',
                              column.align === 'right' && 'justify-end',
                            )}
                          >
                            {column.header}
                            <HelpTip text={column.help} />
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, pageIndex) => {
                    const index = offset + pageIndex;
                    const expanded = renderExpanded?.(row, index) ?? null;
                    const isExpanded = expanded !== null && expanded !== false;

                    return (
                      <React.Fragment key={rowKey(row)}>
                        <tr
                          data-slot="data-table-row"
                          data-arrived={arrived.has(rowKey(row)) || undefined}
                          data-expanded={isExpanded || undefined}
                          aria-expanded={renderExpanded === undefined ? undefined : isExpanded}
                          style={enterStep(pageIndex)}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? handleRowClick(row) : undefined}
                          onKeyDown={isClickable ? handleRowKeyDown(row) : undefined}
                          className={cn(
                            'border-line-soft hover:bg-surface-2 border-b transition-colors duration-(--duration-state) ease-standard last:border-b-0',
                            isClickable && 'cursor-pointer',
                            // Abierta, la fila y su detalle se leen como una sola pieza.
                            isExpanded && 'bg-surface-2 border-b-0',
                          )}
                        >
                          <td className="h-row w-(--ref-col-w) px-4 py-2.5 align-middle text-left whitespace-nowrap">
                            <Reference value={reference(row, index)} />
                          </td>
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className={cn(
                                'h-row px-4 py-2.5 align-middle text-dense',
                                column.align === 'right' && 'text-right tabular-nums',
                                column.className,
                              )}
                            >
                              {column.stack === 'actions' ? (
                                <div className="flex flex-nowrap items-center justify-end gap-2">
                                  {column.cell(row, index)}
                                </div>
                              ) : (
                                column.cell(row, index)
                              )}
                            </td>
                          ))}
                        </tr>
                        {isExpanded ? (
                          <tr
                            data-slot="data-table-expanded"
                            className="border-line-soft bg-surface-2 border-b last:border-b-0"
                          >
                            <td
                              colSpan={columns.length + 1}
                              className="px-4 pt-0.5 pb-4 pl-(--ref-col-w)"
                            >
                              {expanded}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pages !== null ? (
              <Pager
                label={pageLabel(pages, rows.length)}
                page={pages.page}
                pages={pages.pages}
                onPage={goToPage}
                className="border-line-soft border-t"
              />
            ) : null}
          </div>

          {/* Táctil (<1100px): la misma tarjeta apilada según stack. */}
          <div className="flex flex-col gap-2.5 min-table:hidden">
            {visibleRows.map((row, pageIndex) => {
              const index = offset + pageIndex;

              return (
                <article
                  key={rowKey(row)}
                  data-slot="data-table-row"
                  data-arrived={arrived.has(rowKey(row)) || undefined}
                  style={enterStep(pageIndex)}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? handleRowClick(row) : undefined}
                  onKeyDown={isClickable ? handleRowKeyDown(row) : undefined}
                  className={cn(
                    'border-line-soft bg-surface rounded-row border transition-colors duration-(--duration-state) ease-standard hover:border-line hover:bg-surface-2',
                    'flex flex-col gap-2.5 p-3.5',
                    isClickable && 'cursor-pointer',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Reference value={reference(row, index)} />
                    {asides.map((column) => (
                      <span key={column.key}>{column.cell(row, index)}</span>
                    ))}
                  </div>

                  {/* Título */}
                  {titles.map((column) => (
                    <div key={column.key} className="text-body">
                      {column.cell(row, index)}
                    </div>
                  ))}

                  {/* Campos rotulados */}
                  {fields.length === 0 ? null : (
                    <dl className="flex flex-col gap-1">
                      {fields.map((column) => (
                        <div key={column.key} className="flex items-baseline justify-between gap-3">
                          <dt className="text-text-faint inline-flex shrink-0 items-center gap-1.5 text-label">
                            {column.header}
                            {column.help === undefined ? null : <HelpTip text={column.help} />}
                          </dt>
                          <dd
                            className={cn(
                              'text-dense min-w-0 text-right break-words [&_.truncate]:whitespace-normal',
                              column.align === 'right' && 'tabular-nums',
                            )}
                          >
                            {column.cell(row, index)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {/* Acciones al pie */}
                  {(() => {
                    const renderedActions = actions
                      .map((column) => ({ key: column.key, node: column.cell(row, index) }))
                      .filter(
                        (item) =>
                          item.node !== null &&
                          item.node !== undefined &&
                          item.node !== false &&
                          item.node !== '',
                      );

                    if (renderedActions.length === 0) return null;

                    return (
                      <div className="border-line-soft flex flex-col gap-2 border-t pt-2.5 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-center">
                        {renderedActions.map((item) => (
                          <React.Fragment key={item.key}>{item.node}</React.Fragment>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Lo que la fila abre debajo (091), pegado a la tarjeta. */}
                  {(() => {
                    const expanded = renderExpanded?.(row, index) ?? null;
                    if (expanded === null || expanded === false) return null;

                    return (
                      // Tocar adentro del detalle no es tocar la tarjeta: no la abre ni la cierra.
                      <div
                        data-slot="data-table-expanded"
                        className="border-line-soft border-t pt-2.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {expanded}
                      </div>
                    );
                  })()}
                </article>
              );
            })}
            {pages !== null ? (
              <Pager
                label={pageLabel(pages, rows.length)}
                page={pages.page}
                pages={pages.pages}
                onPage={goToPage}
                className="border-line-soft bg-surface rounded-row border"
              />
            ) : null}
          </div>
        </>
      ) : null}

      {state === 'loading' ? <ListSkeleton label={LOADING_LABEL} /> : null}

      {state === 'empty' ? (
        <EmptyState title={emptyTitle} description={emptyMessage} action={emptyAction} />
      ) : null}

      {state === 'error' ? (
        <p
          role="alert"
          className="border-line-soft bg-surface text-danger-text rounded-row border px-4.5 py-4 text-body"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

/**
 * El pie del paginado (spec 067): «Anterior · 1–10 de 69 · Siguiente». En
 * escritorio cuelga dentro de la lámina; apilado es una tarjeta propia con la
 * cuenta arriba y los dos botones a todo el ancho, de 44px en la bahía.
 */
function Pager({
  label,
  page,
  pages,
  onPage,
  className,
}: {
  label: string;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label="Páginas"
      className={cn(
        'bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5',
        className,
      )}
    >
      <p
        aria-live="polite"
        className="text-text-dim order-first min-w-[12ch] basis-full text-center text-body tabular-nums min-table:order-none min-table:flex-1 min-table:basis-auto"
      >
        {label}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
        className="max-table:h-auto max-table:min-h-[max(var(--touch-min),44px)] max-table:flex-1 min-table:-order-1"
      >
        Anterior
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className="max-table:h-auto max-table:min-h-[max(var(--touch-min),44px)] max-table:flex-1"
      >
        Siguiente
      </Button>
    </nav>
  );
}
