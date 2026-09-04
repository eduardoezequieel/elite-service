'use client';

import { useTickets } from '@/features/carwash/hooks/use-tickets';
import { usePermissions } from '@/features/auth/hooks/use-permissions';

/** Los lavados que todavía piden trabajo: en la bahía o esperando cobro. */
const PENDING_STATUSES = 'OPEN,READY';

/**
 * Los contadores que el riel pinta a la derecha de una pestaña.
 *
 * Hoy solo «Lavados» tiene uno: cuántos lavados están pendientes. Se pide **solo
 * si el usuario tiene `carwash.read`** —sin el permiso la consulta ni siquiera
 * sale— y se muestra solo si el número es mayor que cero: un cero en un globo no
 * informa, decora.
 *
 * Devuelve un mapa por `href` para que el riel no tenga que saber de dónde sale
 * cada número.
 */
export function useNavCounts(): Readonly<Record<string, number | undefined>> {
  const { can } = usePermissions();
  const allowed = can('carwash.read');

  const pending = useTickets({ status: PENDING_STATUSES }, allowed);
  const total = pending.data?.length ?? 0;

  return { '/carwash': allowed && total > 0 ? total : undefined };
}
