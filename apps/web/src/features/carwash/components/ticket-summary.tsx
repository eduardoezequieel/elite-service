'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { cn } from '@/lib/utils';

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
 * Queda fijo a la derecha en escritorio (`xl`, 1180px). Bajo ese ancho se
 * convierte en una barra fija al pie con el total y `Abrir lavado` (alto
 * `--control-h`). Solo el total, sin desglose de servicios.
 *
 * Si la pantalla tiene la barra inferior del riel (<900px en oficina), se
 * apila por encima.
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
  hasBottomRail = false,
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
  /** Si la pantalla tiene la barra inferior del riel (<900px en oficina). */
  hasBottomRail?: boolean;
}) {
  return (
    <>
      {/* Resumen lateral en escritorio ancho (≥1180px) */}
      <aside className="hidden xl:sticky xl:top-6 xl:block">
        <Card className="gap-0 px-card">
          <div className="border-line bg-surface-2 mb-4 flex flex-wrap items-center gap-2.5 rounded-control border px-3.5 py-3">
            {plate.trim() === '' ? (
              <PlateChip plate="P000-000" className="text-text-faint" />
            ) : (
              <PlateChip plate={plate.trim()} />
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

      {/* Barra fija al pie en pantallas < 1180px: solo total y botón primario */}
      <div
        className={cn(
          'border-line bg-surface/95 fixed inset-x-0 z-20 border-t shadow-elite backdrop-blur-sm xl:hidden',
          hasBottomRail
            ? 'bottom-[calc(64px+env(safe-area-inset-bottom))] py-2.5 md:bottom-0 md:left-[248px] md:pt-2.5 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]'
            : 'bottom-0 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-[34px]">
          <div className="flex min-w-0 flex-col justify-center">
            <span className="text-text-faint text-label leading-none">Total</span>
            <span className="text-figure text-text tabular-nums leading-tight">
              ${(total / 100).toFixed(2)}
            </span>
          </div>

          <Button
            type="submit"
            size="default"
            className="w-[152px] shrink-0"
            loading={isSubmitting}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Guardando…' : 'Abrir lavado'}
          </Button>
        </div>
      </div>
    </>
  );
}
