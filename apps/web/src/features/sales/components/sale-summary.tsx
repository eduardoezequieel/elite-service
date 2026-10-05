'use client';

import { centsToAmount } from '@/lib/money';
import { formatQuantity, milliToQuantity } from '@/lib/quantity';
import { lineTotalCents, type CartLine } from '../sale-cart';

/**
 * Lo que se lleva, de solo lectura (105): cada producto con su `×cant` y su
 * monto, los lavados sumados (066) y el total. Se edita en la lista de la
 * izquierda; acá solo se lee.
 */
export function SaleSummary({
  lines,
  washes = [],
  totalCents,
}: {
  lines: readonly CartLine[];
  /** Los lavados listos cobrados en la misma cuenta (066). */
  washes?: readonly { id: string; label: string; total: string }[];
  totalCents: number;
}) {
  const empty = lines.length === 0 && washes.length === 0;

  return (
    <div className="flex flex-col">
      {empty ? (
        <p className="text-text-faint border-line rounded-row border border-dashed px-4 py-5 text-center text-body">
          Sin productos
        </p>
      ) : (
        <ul className="flex flex-col">
          {washes.map((wash) => (
            <SummaryLine key={wash.id} name={wash.label} amount={wash.total} />
          ))}
          {lines.map((line) => (
            <SummaryLine
              key={line.itemId}
              name={line.name}
              mark={`×${formatQuantity(milliToQuantity(line.quantity))}`}
              amount={centsToAmount(lineTotalCents(line))}
            />
          ))}
        </ul>
      )}

      <div className="border-line mt-2 flex items-baseline justify-between gap-3 border-t pt-3">
        <span className="text-text-dim">Total</span>
        <span className="text-figure text-text tabular-nums [[data-density=bahia]_&]:text-(length:--stat-size-lg)">
          ${centsToAmount(totalCents)}
        </span>
      </div>
    </div>
  );
}

function SummaryLine({ name, mark, amount }: { name: string; mark?: string; amount: string }) {
  return (
    <li className="border-line-soft grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 border-b py-2 last:border-b-0">
      <span className="text-text min-w-0 font-semibold [[data-density=bahia]_&]:text-title">
        {name}
      </span>
      <span className="text-text-faint tabular-nums">{mark ?? ''}</span>
      <span className="text-text min-w-16 text-right font-mono tabular-nums">${amount}</span>
    </li>
  );
}
