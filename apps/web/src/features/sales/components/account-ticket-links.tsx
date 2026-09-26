'use client';

import { OriginLink } from '@/components/app-shell/origin-link';
import { cn } from '@/lib/utils';
import { accountTicketRefs } from '../sale-format';

/**
 * «Cobrada con #7, #8» (066): los lavados que se cobraron en la misma cuenta
 * que la venta, cada uno enlazado a su ficha. No pinta nada si la venta se
 * cobró sola.
 *
 * Cada enlace ocupa el alto táctil de la densidad (`--touch-min`): en la bahía
 * se toca con el dedo, y un `#7` de 14px no se acierta.
 */
export function AccountTicketLinks({
  tickets,
  className,
}: {
  tickets: readonly { id: string; number: string }[];
  className?: string;
}) {
  const refs = accountTicketRefs(tickets);

  if (refs === null) return null;

  return (
    <span className={cn('text-text-dim inline-flex flex-wrap items-center gap-x-1', className)}>
      Cobrada con
      {refs.map((ref, index) => (
        <span key={ref.id} className="inline-flex items-center">
          <OriginLink
            href={`/carwash/${ref.id}`}
            className="text-flame-text inline-flex min-h-(--touch-min) items-center font-mono font-semibold hover:underline"
          >
            {ref.label}
          </OriginLink>
          {index < refs.length - 1 ? ',' : null}
        </span>
      ))}
    </span>
  );
}
