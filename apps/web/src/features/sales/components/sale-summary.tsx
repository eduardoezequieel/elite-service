'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { centsToAmount } from '@/lib/money';
import { formatQuantity, milliToQuantity } from '@/lib/quantity';
import { lineTotalCents, type CartLine } from '../sale-cart';

/**
 * El resumen de la venta, siempre a la vista (059, 065).
 *
 * Fijo a la derecha desde 1180px; bajo ese ancho se vuelve la barra fija al pie
 * con el total, el cambio y el botón, como el cobro de la 059 y el alta del
 * lavado. En oficina, bajo 900px, se apila encima de la barra del riel.
 *
 * El botón dice qué falta —«Falta efectivo», «Falta $1.50», «Sin turno
 * abierto»— y no llama al API hasta que deje de faltar.
 */
export function SaleSummary({
  lines,
  washes = [],
  totalCents,
  split,
  paidCents,
  showCash,
  tenderedCents,
  changeCents,
  cashShort,
  blocker,
  verb,
  isSubmitting,
  onSubmit,
  note,
  errorMessage,
}: {
  lines: readonly CartLine[];
  /** Los lavados listos cobrados en la misma cuenta (066). */
  washes?: readonly { id: string; label: string; total: string }[];
  totalCents: number;
  split: boolean;
  paidCents: number;
  /** Algo del cobro es efectivo y se tecleó con cuánto paga. */
  showCash: boolean;
  tenderedCents: number;
  changeCents: number;
  cashShort: boolean;
  /** Por qué no se puede cobrar, o `null`. */
  blocker: string | null;
  /** «Cobrar en efectivo», «Cobrar 2 pagos». */
  verb: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  note: string;
  errorMessage: string | null;
}) {
  const label = blocker ?? verb;

  return (
    <>
      <aside className="hidden xl:sticky xl:top-6 xl:block">
        <Card className="gap-0 px-card">
          <h2 className="text-title text-text mb-1">Resumen</h2>

          {washes.length === 0 ? null : (
            <ul className="border-line-soft mb-1 flex flex-col border-b pb-1">
              {washes.map((wash) => (
                <li key={wash.id} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-text-dim min-w-0 text-dense">{wash.label}</span>
                  <span className="text-text font-mono text-dense font-semibold tabular-nums">
                    ${wash.total}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {lines.length === 0 ? (
            <p className="text-text-faint text-dense py-2">Sin productos.</p>
          ) : (
            <ul className="flex flex-col">
              {lines.map((line) => (
                <li key={line.itemId} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span className="text-text-dim min-w-0 text-dense">
                    {line.name}{' '}
                    <span className="text-text-faint font-mono tabular-nums">
                      {formatQuantity(milliToQuantity(line.quantity))} × ${line.unitPrice}
                    </span>
                  </span>
                  <span className="text-text font-mono text-dense font-semibold tabular-nums">
                    ${centsToAmount(lineTotalCents(line))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-line mt-2 flex items-baseline justify-between gap-3 border-t pt-3">
            <span className="text-text-faint text-label">Total</span>
            <span className="text-figure text-text tabular-nums">${centsToAmount(totalCents)}</span>
          </div>

          {split ? <SummaryRow label="Cubierto" value={`$${centsToAmount(paidCents)}`} /> : null}
          {showCash ? (
            <>
              <SummaryRow label="Con cuánto paga" value={`$${centsToAmount(tenderedCents)}`} />
              <SummaryRow
                label={cashShort ? 'Falta efectivo' : 'Cambio'}
                value={`$${centsToAmount(Math.abs(changeCents))}`}
                tone={cashShort ? 'danger' : 'go'}
              />
            </>
          ) : null}
          <SummaryRow
            label="Comisión"
            value={washes.length === 0 ? 'no genera' : 'solo los lavados'}
            tone="faint"
          />

          <Button
            type="button"
            size="lg"
            className="mt-4 w-full"
            loading={isSubmitting}
            disabled={blocker !== null || isSubmitting}
            onClick={onSubmit}
          >
            {label}
          </Button>

          <p className="text-text-faint text-label mt-2.5 text-center font-normal">{note}</p>

          {/* El sitio del error se reserva: el resumen no salta cuando el API dice que no. */}
          <div className="mt-2 min-h-9">
            {errorMessage === null ? null : (
              <p className="text-danger-text text-dense" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
        </Card>
      </aside>

      <div
        className={cn(
          'border-line bg-surface/95 fixed inset-x-0 z-20 border-t backdrop-blur-sm xl:hidden',
          'bottom-[calc(64px+env(safe-area-inset-bottom))] py-2.5 transition-[left] duration-(--duration-state) ease-standard',
          'md:bottom-0 md:left-(--rail-width) md:pt-2.5 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 md:px-[34px]">
          <div className="flex min-w-0 flex-col justify-center">
            <span className="text-text-faint text-label leading-none">Total</span>
            <span className="text-figure text-text tabular-nums leading-tight">
              ${centsToAmount(totalCents)}
            </span>
          </div>
          {showCash && !cashShort ? (
            <div className="flex min-w-0 flex-col justify-center">
              <span className="text-text-faint text-label leading-none">Cambio</span>
              <span className="text-figure text-go-text tabular-nums leading-tight">
                ${centsToAmount(Math.max(0, changeCents))}
              </span>
            </div>
          ) : null}

          <Button
            type="button"
            className="ml-auto min-w-[152px] shrink-0"
            loading={isSubmitting}
            disabled={blocker !== null || isSubmitting}
            onClick={onSubmit}
          >
            {blocker ?? 'Cobrar'}
          </Button>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'go' | 'danger' | 'faint';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={cn('text-dense', tone === 'faint' ? 'text-text-faint' : 'text-text-dim')}>
        {label}
      </span>
      <span
        className={cn(
          'text-dense tabular-nums',
          tone === 'faint' ? 'text-text-faint' : 'font-mono font-semibold',
          tone === 'go' && 'text-go-text',
          tone === 'danger' && 'text-danger-text',
          tone === 'default' && 'text-text',
        )}
      >
        {value}
      </span>
    </div>
  );
}
