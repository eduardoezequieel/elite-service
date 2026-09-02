'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Reference } from '@/components/ui/reference';

/**
 * La lista del sistema: **una sola lista para todas las pantallas**.
 *
 * Las columnas se declaran una vez y de esa misma declaración salen las dos
 * formas:
 *
 * - **Escritorio (≥900px):** una cabecera de columnas tenue y, debajo, cada fila
 *   como una tarjeta propia en rejilla CSS —radio 12, filete `--line-soft`,
 *   sombra única, 10px de separación—. Ya no hay `<table>`: la fila es una
 *   lámina, no una celda.
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
  /**
   * Las columnas de la rejilla en escritorio, en sintaxis de
   * `grid-template-columns`. Por defecto se calcula de las columnas declaradas
   * (ver `gridTemplateFor`).
   */
  gridTemplate?: string;
  className?: string;
}

/** El texto de carga es uno solo en todo el sistema. */
const LOADING_MESSAGE = 'Cargando…';

/** El título del vacío cuando la pantalla no dice otro. */
const DEFAULT_EMPTY_TITLE = 'Nada por aquí todavía';

/**
 * La rejilla por defecto: referencia fija, el dato que nombra la fila se come el
 * sobrante, los números tienen un ancho estable para que la columna alinee y el
 * resto se acomoda a su contenido sin bajar de un mínimo legible.
 */
function gridTemplateFor<Row>(columns: readonly DataTableColumn<Row>[]): string {
  const track = (column: DataTableColumn<Row>): string => {
    if ((column.stack ?? 'field') === 'title') return 'minmax(0,1fr)';
    if ((column.stack ?? 'field') === 'actions') return 'auto';
    if (column.align === 'right') return '110px';
    return 'minmax(90px,auto)';
  };

  return ['72px', ...columns.map(track)].join(' ');
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  reference = (_row, index) => index + 1,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyMessage,
  emptyAction,
  isLoading = false,
  errorMessage = null,
  gridTemplate,
  className,
}: DataTableProps<Row>) {
  // Un fallo manda sobre todo lo demás: mejor decir que la lista no cargó que
  // dejar a la vista datos viejos como si fueran los de ahora.
  const state: 'rows' | 'loading' | 'empty' | 'error' =
    errorMessage !== null ? 'error' : rows.length > 0 ? 'rows' : isLoading ? 'loading' : 'empty';

  const pick = (stack: DataTableStack) =>
    columns.filter((column) => (column.stack ?? 'field') === stack);

  const titles = pick('title');
  const asides = pick('aside');
  const fields = pick('field');
  const actions = pick('actions');

  const template = gridTemplate ?? gridTemplateFor(columns);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Cabecera de columnas: solo en escritorio, y solo si hay filas que
          encabezar. Cuando no las hay, el vacío ocupa toda la caja. */}
      {state === 'rows' ? (
        <div
          aria-hidden
          className="text-text-faint hidden gap-3.5 px-[18px] pb-1 text-label font-semibold md:grid"
          style={{ gridTemplateColumns: template }}
        >
          <span>Ref.</span>
          {columns.map((column) => (
            <span
              key={column.key}
              className={cn(
                'truncate',
                (column.align === 'right' || column.stack === 'actions') && 'text-right',
                column.headerClassName,
              )}
            >
              {column.header}
            </span>
          ))}
        </div>
      ) : null}

      {state === 'rows' ? (
        <div className="flex flex-col gap-2.5">
          {rows.map((row, index) => (
            <article
              key={rowKey(row)}
              data-slot="data-table-row"
              className={cn(
                'border-line-soft bg-surface shadow-elite rounded-row border transition-colors duration-(--duration-state) ease-standard hover:border-line hover:bg-surface-2',
                // Táctil: la tarjeta se apila. Escritorio: la rejilla declarada.
                'flex flex-col gap-2.5 p-[14px] md:block md:px-[18px]',
              )}
            >
              <div className="flex items-center justify-between gap-3 md:hidden">
                <Reference value={reference(row, index)} />
                {asides.map((column) => (
                  <span key={column.key}>{column.cell(row, index)}</span>
                ))}
              </div>

              {/* Escritorio: la misma fila, en rejilla. Se dibuja aparte para que
                  el orden de las columnas sea el declarado y no el del apilado. */}
              <div
                className="hidden gap-3.5 md:grid md:items-center"
                style={{ gridTemplateColumns: template }}
              >
                <Reference value={reference(row, index)} />
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={cn(
                      'min-w-0',
                      column.align === 'right' && 'text-right tabular-nums',
                      column.stack === 'actions' && 'flex flex-wrap items-center justify-end gap-2',
                      column.className,
                    )}
                  >
                    {column.cell(row, index)}
                  </div>
                ))}
              </div>

              {/* Táctil: título, campos rotulados y acciones al pie. */}
              {titles.map((column) => (
                <div key={column.key} className="text-body md:hidden">
                  {column.cell(row, index)}
                </div>
              ))}

              {fields.length === 0 ? null : (
                <dl className="flex flex-col gap-1 md:hidden">
                  {fields.map((column) => (
                    <div key={column.key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-text-faint shrink-0 text-label">{column.header}</dt>
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

              {actions.length === 0 ? null : (
                <div className="border-line-soft flex flex-col gap-2 border-t pt-2.5 md:hidden [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-center">
                  {actions.map((column) => (
                    <React.Fragment key={column.key}>{column.cell(row, index)}</React.Fragment>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}

      {state === 'loading' ? (
        <p className="border-line-soft bg-surface text-text-dim rounded-row border px-[18px] py-4 text-body">
          {LOADING_MESSAGE}
        </p>
      ) : null}

      {state === 'empty' ? (
        <EmptyState title={emptyTitle} description={emptyMessage} action={emptyAction} />
      ) : null}

      {state === 'error' ? (
        <p
          role="alert"
          className="border-line-soft bg-surface text-danger-text rounded-row border px-[18px] py-4 text-body"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
