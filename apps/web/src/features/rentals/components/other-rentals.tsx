'use client';

import { MAX_PAGE_SIZE, PERMISSIONS } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';
import { ArrowRight } from 'lucide-react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { DataTable } from '@/components/ui/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useAgreements } from '../hooks/use-agreements';
import { otherRentals } from '../other-rentals';
import { agreementColumns, contractReference } from './agreement-columns';

const COLUMNS = agreementColumns({ withCustomer: false });

/** El ancla de la sección: el dato del encabezado baja hasta ella. */
const SECTION_ID = 'other-rentals';

/**
 * Las otras rentas del cliente (128). El dato y la sección comparten la misma
 * clave de react-query: una sola consulta. Sin `rentals.read` no hay nada.
 */
function useOtherRentals(agreement: RentalAgreement) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.rentals.actions.read.key);
  const page = useAgreements(
    { customerId: agreement.customerId, page: 1, pageSize: MAX_PAGE_SIZE },
    canRead,
  );

  return canRead && page.data !== undefined ? otherRentals(page.data, agreement.id) : null;
}

const pill =
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-dense font-semibold whitespace-nowrap';

/** Junto al nombre del cliente: «Debe $50.00», «5 rentas» o «Cliente nuevo». */
export function OtherRentalsTag({ agreement }: { agreement: RentalAgreement }) {
  const others = useOtherRentals(agreement);
  if (others === null) return null;

  if (others.count === 0) {
    return <span className={cn(pill, 'tint text-info-text w-fit')}>Cliente nuevo</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      {others.owed === null ? null : (
        <a href={`#${SECTION_ID}`} className="inline-flex min-h-(--touch-min) items-center">
          <span className={cn(pill, 'tint text-danger-text')}>Debe {formatMoney(others.owed)}</span>
        </a>
      )}
      <a href={`#${SECTION_ID}`} className="group inline-flex min-h-(--touch-min) items-center">
        <span
          className={cn(
            pill,
            'border-line bg-surface-2 text-text-dim transition-colors duration-(--duration-state)',
            'group-hover:border-flame group-hover:text-text',
          )}
        >
          {others.count} {others.count === 1 ? 'renta' : 'rentas'}
        </span>
      </a>
    </span>
  );
}

/** Al final de la ficha: las últimas tres, sin la abierta, y «Ver todas» si hay más. */
export function OtherRentals({ agreement }: { agreement: RentalAgreement }) {
  const { can } = usePermissions();
  const canReadRenters = can(PERMISSIONS.renters.actions.read.key);
  const others = useOtherRentals(agreement);
  if (others === null || others.count === 0) return null;

  return (
    <section id={SECTION_ID} className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-text">
          Otras rentas <span className="text-text-faint font-medium">{others.count}</span>
        </h2>
        {others.count > others.rows.length && canReadRenters ? (
          <OriginLink
            href={`/rentals/customers/${agreement.customerId}`}
            className="text-info-text inline-flex min-h-(--touch-min) items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
          >
            Ver todas
            <ArrowRight className="size-icon" strokeWidth={1.5} aria-hidden />
          </OriginLink>
        ) : null}
      </div>
      <DataTable
        rows={others.rows}
        rowKey={(row) => row.id}
        renderReference={contractReference}
        rowHref={(row) => `/rentals/agreements/${row.id}`}
        emptyMessage="Sin otras rentas."
        columns={COLUMNS}
      />
    </section>
  );
}
