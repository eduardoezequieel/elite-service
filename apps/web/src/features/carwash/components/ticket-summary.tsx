'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';

/** Una línea del resumen: un servicio elegido con su precio ya resuelto. */
export interface TicketSummaryLine {
  id: string;
  name: string;
  /** El precio del catálogo para el tipo de carro elegido, como cadena. */
  price: string;
}

/**
 * El resumen del alta: lo que se está por abrir, siempre a la vista.
 *
 * Queda fijo a la derecha en escritorio (`xl`, 1180px) y baja al final del
 * formulario en cuanto la pantalla se estrecha, con el primario a todo el ancho.
 * No decide nada: solo dibuja el estado del formulario y lleva el botón de
 * envío, que sigue siendo el `submit` del único `<form>` de la pantalla.
 */
export function TicketSummary({
  plate,
  bodyTypeName,
  customerName,
  lines,
  total,
  isSubmitting,
  canSubmit,
  errorMessage,
}: {
  plate: string;
  bodyTypeName?: string;
  customerName: string;
  lines: TicketSummaryLine[];
  /** El total en centavos enteros, como lo calcula el formulario. */
  total: number;
  isSubmitting: boolean;
  canSubmit: boolean;
  errorMessage?: string;
}) {
  return (
    <aside className="xl:sticky xl:top-6">
      <Card className="gap-0 px-card">
        <div className="border-line bg-surface-2 mb-4 flex flex-wrap items-center gap-2.5 rounded-control border px-3.5 py-3">
          {plate.trim() === '' ? (
            <PlateChip plate="P000-000" className="text-text-faint" />
          ) : (
            <PlateChip plate={plate.trim()} className="uppercase" />
          )}
          {bodyTypeName === undefined ? null : (
            <span className="text-text-faint text-dense">{bodyTypeName}</span>
          )}
        </div>

        <h2 className="text-title text-text mb-1">Resumen</h2>

        {lines.length === 0 ? (
          <p className="text-text-faint text-dense py-2">
            Todavía no elegiste ningún servicio.
          </p>
        ) : (
          <ul className="flex flex-col">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-text-dim text-dense">{line.name}</span>
                <span className="text-text font-mono text-dense font-semibold tabular-nums">
                  ${line.price}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-line-soft my-2 border-t" />

        {customerName.trim() === '' ? null : (
          <div className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-text-dim text-dense">Cliente</span>
            <span className="text-text min-w-0 truncate text-dense font-semibold">
              {customerName.trim()}
            </span>
          </div>
        )}

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-text-faint text-label">Total</span>
          <span className="text-figure text-text tabular-nums">${(total / 100).toFixed(2)}</span>
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-4 w-full"
          loading={isSubmitting}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Guardando…' : 'Abrir lavado'}
        </Button>

        <p className="text-text-faint text-label mt-2.5 text-center font-normal">
          Entra a la fila como Abierto. El cobro se hace en oficina.
        </p>

        {/* El sitio del error se reserva siempre: el resumen no salta cuando el
            API contesta que no. */}
        <div className="mt-2 min-h-9">
          {errorMessage === undefined ? null : (
            <p className="text-danger-text text-dense" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </Card>
    </aside>
  );
}
