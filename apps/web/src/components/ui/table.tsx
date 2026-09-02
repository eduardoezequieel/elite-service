'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * La tabla es el componente central del sistema, no un caso más.
 *
 * Sin cebra: el filete de 1px basta y la cebra pelea con los sellos. La cabecera
 * lleva un filete Regla debajo, la fila viva se marca con fondo Papel y la fila
 * seleccionada suma una barra izquierda de 2px en Naranja Elite. Las cifras
 * tabulares ya vienen de `globals.css` para todo `th`/`td`.
 *
 * **La tabla trae su lámina puesta.** El filete, el radio y el fondo Lámina son
 * parte de la tabla y no de la pantalla: así ninguna pantalla puede olvidarse la
 * caja y terminar con una tabla suelta al lado de otra enmarcada. Solo la
 * referencia de diseño la apaga con `plated={false}`, porque ahí la tabla ya vive
 * dentro de una lámina.
 *
 * Casi ninguna pantalla usa esto directo: la forma normal de listar es
 * `<DataTable>` (`components/ui/data-table.tsx`), que arma con estas piezas la
 * tabla de escritorio y la pila de láminas táctil desde una sola definición de
 * columnas.
 */
function Table({
  className,
  plated = true,
  ...props
}: React.ComponentProps<'table'> & {
  /** La lámina que enmarca la tabla. Solo se apaga dentro de otra lámina. */
  plated?: boolean;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        'relative w-full overflow-x-auto',
        plated && 'rounded-lg border border-rule bg-card',
      )}
    >
      <table data-slot="table" className={cn('w-full caption-bottom', className)} {...props} />
    </div>
  );
}

/**
 * La cabecera nunca reacciona al puntero: no es una fila accionable, así que no
 * se prende al pasar por encima. Va acá y no en cada pantalla.
 */
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-rule [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-rule text-dense font-semibold [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-border transition-colors duration-(--duration-state) ease-standard hover:bg-background has-aria-expanded:bg-background data-[state=selected]:bg-background data-[state=selected]:shadow-[inset_2px_0_0_0_var(--brand)]',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-row px-2 first:pl-plate last:pr-plate text-left align-middle text-label text-muted-foreground whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-row px-2 first:pl-plate last:pr-plate align-middle text-dense whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-dense text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
