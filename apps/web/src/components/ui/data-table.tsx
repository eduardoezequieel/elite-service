'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Reference } from '@/components/ui/reference';

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
  /** @deprecated Ya no se usa rejilla CSS suelta en escritorio; la tabla nativa calcula sus columnas. */
  gridTemplate?: string;
  className?: string;
}

/** El texto de carga es uno solo en todo el sistema. */
const LOADING_MESSAGE = 'Cargando…';

/** El título del vacío cuando la pantalla no dice otro. */
const DEFAULT_EMPTY_TITLE = 'Nada por aquí todavía';

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  reference = (_row, index) => index + 1,
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyMessage,
  emptyAction,
  isLoading = false,
  errorMessage = null,
  className,
}: DataTableProps<Row>) {
  const router = useRouter();
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

  return (
    <div className={cn('flex flex-col', className)}>
      {state === 'rows' ? (
        <>
          {/* Escritorio (≥1100px): la tabla unificada. Bajo eso, tarjetas. */}
          <div className="border-line-soft bg-surface shadow-elite hidden overflow-x-auto rounded-row border min-[1100px]:block">
            <table className="w-full border-collapse text-left">
              <thead className="bg-surface-2">
                <tr className="border-line border-b">
                  <th
                    scope="col"
                    className="text-text-faint h-10 w-[72px] px-4 text-left text-label font-semibold whitespace-nowrap"
                  >
                    Ref.
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        'text-text-faint h-10 px-4 text-label font-semibold',
                        (column.align === 'right' || column.stack === 'actions')
                          ? 'text-right'
                          : 'text-left',
                        column.headerClassName,
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={rowKey(row)}
                    data-slot="data-table-row"
                    onClick={
                      rowHref
                        ? (event) => {
                            const target = event.target as HTMLElement | null;
                            if (
                              target?.closest('button, a, input, select, textarea, [role="button"]')
                            ) {
                              return;
                            }
                            router.push(rowHref(row));
                          }
                        : undefined
                    }
                    className={cn(
                      'border-line-soft hover:bg-surface-2 border-b transition-colors duration-(--duration-state) ease-standard last:border-b-0',
                      rowHref && 'cursor-pointer',
                    )}
                  >
                    <td className="h-row w-[72px] px-4 py-2.5 align-middle text-left whitespace-nowrap">
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Táctil (<1100px): la misma tarjeta apilada según stack. */}
          <div className="flex flex-col gap-2.5 min-[1100px]:hidden">
            {rows.map((row, index) => (
              <article
                key={rowKey(row)}
                data-slot="data-table-row"
                onClick={
                  rowHref
                    ? (event) => {
                        const target = event.target as HTMLElement | null;
                        if (
                          target?.closest('button, a, input, select, textarea, [role="button"]')
                        ) {
                          return;
                        }
                        router.push(rowHref(row));
                      }
                    : undefined
                }
                className={cn(
                  'border-line-soft bg-surface shadow-elite rounded-row border transition-colors duration-(--duration-state) ease-standard hover:border-line hover:bg-surface-2',
                  'flex flex-col gap-2.5 p-[14px]',
                  rowHref && 'cursor-pointer',
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

                {/* Acciones al pie */}
                {actions.length === 0 ? null : (
                  <div className="border-line-soft flex flex-col gap-2 border-t pt-2.5 [&_[data-slot=button]]:w-full [&_[data-slot=button]]:justify-center">
                    {actions.map((column) => (
                      <React.Fragment key={column.key}>{column.cell(row, index)}</React.Fragment>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
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
