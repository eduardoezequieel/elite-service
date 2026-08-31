'use client';

import type { ReactNode } from 'react';

import { Reference } from '@/components/ui/reference';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * La tabla del sistema. **Es una sola** (spec 003 → RN-1).
 *
 * Una pantalla no dibuja una tabla: declara columnas. Este componente pone
 * siempre lo mismo —la lámina, la franja de cabecera, el número de referencia
 * en la primera columna, el filete entre filas, el estado de carga, el de error
 * y el vacío— para que dos pantallas distintas no puedan verse distinto.
 *
 * Bajo `md` no hay scroll horizontal a ciegas: las mismas columnas se apilan
 * como fichas numeradas dentro de la misma lámina, y cada columna declara qué
 * papel juega al apilarse (DESIGN.md → Tables).
 */

/** Qué hace una columna cuando la fila se apila en pantalla chica. */
export type StackRole =
  /** El renglón grande de la ficha. Una por tabla. */
  | 'title'
  /** Al lado de la referencia, arriba a la derecha. Una por tabla. */
  | 'meta'
  /** Par etiqueta/valor dentro de la ficha. Es el valor por defecto. */
  | 'field'
  /** El bloque de acciones, al pie de la ficha. Una por tabla. */
  | 'actions'
  /** No se muestra apilada: su dato ya aparece en otra columna. */
  | 'hidden';

export interface DataColumn<T> {
  /** Identificador estable de la columna. */
  id: string;
  /** Cabecera visible, en español y en caja normal. */
  header: string;
  /** El contenido de la celda en la tabla de escritorio. */
  cell: (row: T) => ReactNode;
  /** El contenido cuando la fila se apila, si difiere del de la celda. */
  stackCell?: (row: T) => ReactNode;
  /** Números y dinero a la derecha; texto a la izquierda. */
  align?: 'left' | 'right';
  /** Papel de la columna al apilarse. Por defecto, `field`. */
  stack?: StackRole;
  /** Clase extra de la celda y de su cabecera (ancho, color, quiebre). */
  className?: string;
  /** Oculta la cabecera salvo para lectores de pantalla. */
  hiddenHeader?: boolean;
}

export interface DataTableProps<T> {
  /** Título de la franja de cabecera de la lámina. */
  title: string;
  /** Pista a la derecha de la franja: un recuento, una fecha. */
  meta?: ReactNode;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /**
   * El número de referencia de la fila. Por defecto es su posición en la lista;
   * cuando el objeto tenga folio propio se pasa acá (DESIGN.md → «La Regla del
   * Mismo Número»).
   */
  reference?: (row: T, index: number) => number;
  isLoading?: boolean;
  /** Qué se está trayendo, dicho con la palabra del listado. */
  loadingMessage?: string;
  /** Mensaje del fallo al pedir la lista, o `null`. */
  errorMessage?: string | null;
  /** Qué falta y qué acción lo llenaría. Nunca una ilustración. */
  emptyMessage: string;
  /** Resumen de la tabla para lectores de pantalla. */
  caption: string;
  /** Marca la fila como fuera de servicio: trama de 45°, nunca opacidad. */
  isRowBlocked?: (row: T) => boolean;
}

function alignOf(column: { align?: 'left' | 'right' }): string {
  return column.align === 'right' ? 'text-right' : 'text-left';
}

export function DataTable<T>({
  title,
  meta,
  columns,
  rows,
  rowKey,
  reference,
  isLoading = false,
  loadingMessage = 'Cargando…',
  errorMessage = null,
  emptyMessage,
  caption,
  isRowBlocked,
}: DataTableProps<T>) {
  // La tabla conserva siempre su cabecera: lo que cambia es la línea de abajo.
  const notice =
    errorMessage ?? (isLoading ? loadingMessage : rows.length === 0 ? emptyMessage : null);
  const noticeClass = errorMessage ? 'text-stamp-red' : 'text-muted-foreground';

  const titleColumn = columns.find((column) => column.stack === 'title');
  const metaColumn = columns.find((column) => column.stack === 'meta');
  const actionsColumn = columns.find((column) => column.stack === 'actions');
  const fieldColumns = columns.filter(
    (column) => column.stack === undefined || column.stack === 'field',
  );

  const referenceOf = reference ?? ((_row: T, index: number) => index + 1);

  return (
    <section className="border-rule bg-card overflow-hidden rounded-lg border">
      {/* Franja de cabecera de la lámina: título a la izquierda, pista a la
          derecha, separada del cuerpo por un filete (DESIGN.md → Plates). */}
      <header className="border-rule flex min-h-10 flex-wrap items-center justify-between gap-2 border-b px-plate py-2">
        <h2 className="text-title">{title}</h2>
        {meta ? <span className="text-label text-muted-foreground font-normal">{meta}</span> : null}
      </header>

      {/* Escritorio: la tabla. */}
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 pl-plate">Ref.</TableHead>
              {columns.map((column, columnIndex) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    alignOf(column),
                    columnIndex === columns.length - 1 && 'pr-plate',
                    column.className,
                  )}
                >
                  {column.hiddenHeader ? (
                    <span className="sr-only">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {notice ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 1}
                  className={cn('px-plate whitespace-normal', noticeClass)}
                >
                  {notice}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={rowKey(row)} className={cn(isRowBlocked?.(row) && 'is-blocked')}>
                  <TableCell className="pl-plate align-middle">
                    <Reference value={referenceOf(row, index)} />
                  </TableCell>
                  {columns.map((column, columnIndex) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        'align-middle',
                        alignOf(column),
                        columnIndex === columns.length - 1 && 'pr-plate',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Táctil: las mismas columnas, apiladas como fichas numeradas. */}
      <div className="divide-border flex flex-col divide-y md:hidden">
        {notice ? (
          <p className={cn('text-body px-plate py-3', noticeClass)}>{notice}</p>
        ) : (
          rows.map((row, index) => (
            <article
              key={rowKey(row)}
              className={cn(
                'flex flex-col gap-2 px-plate py-3',
                isRowBlocked?.(row) && 'is-blocked',
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <Reference value={referenceOf(row, index)} />
                {metaColumn ? (
                  <span className="text-label text-muted-foreground font-normal">
                    {(metaColumn.stackCell ?? metaColumn.cell)(row)}
                  </span>
                ) : null}
              </div>

              {titleColumn ? (
                <div className="text-body font-medium">
                  {(titleColumn.stackCell ?? titleColumn.cell)(row)}
                </div>
              ) : null}

              {fieldColumns.map((column) => (
                <div
                  key={column.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                >
                  <span className="text-label text-muted-foreground font-normal">
                    {column.header}
                  </span>
                  <span className="text-dense min-w-0 text-right">
                    {(column.stackCell ?? column.cell)(row)}
                  </span>
                </div>
              ))}

              {actionsColumn ? (
                <div className="mt-1 flex justify-end">
                  {(actionsColumn.stackCell ?? actionsColumn.cell)(row)}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
