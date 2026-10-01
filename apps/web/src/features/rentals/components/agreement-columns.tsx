'use client';

import { rentalWhenLabel } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';

import type { DataTableColumn } from '@/components/ui/data-table';
import { PlateChip } from '@/components/ui/plate-chip';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { isNegativeAmount, vehicleTitle } from '../agreement-format';
import { AgreementStatusStamp } from './agreement-status-stamp';

/** La referencia de una renta en las listas: su número de contrato, o la posición si no tiene. */
export function agreementReference(agreement: RentalAgreement, index: number): number {
  return agreement.contractNumber ?? index + 1;
}

/** Sale y regresa: lo real cuando ya pasó, lo planificado si no. */
function WhenCell({ agreement }: { agreement: RentalAgreement }) {
  const pickup = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const returnAt = agreement.actualReturnAt ?? agreement.plannedReturnAt;

  return (
    <span className="text-dense flex flex-col tabular-nums">
      <span>Sale {rentalWhenLabel(pickup)}</span>
      <span className="text-text-dim">Regresa {rentalWhenLabel(returnAt)}</span>
    </span>
  );
}

function BalanceCell({ agreement }: { agreement: RentalAgreement }) {
  const balance = agreement.totals.balance;
  const owes = !isNegativeAmount(balance) && balance !== '0.00';

  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        owes && agreement.status !== 'CANCELLED' ? 'text-danger-text font-bold' : 'text-text-dim',
      )}
    >
      {formatMoney(balance)}
    </span>
  );
}

/**
 * Las columnas de una lista de rentas (096): Rentas y el historial del cliente.
 * Orden del sistema: Ref. · lo que nombra la fila · el resto · Estado.
 */
export function agreementColumns({
  withCustomer = true,
}: { withCustomer?: boolean } = {}): DataTableColumn<RentalAgreement>[] {
  return [
    ...(withCustomer
      ? [
          {
            key: 'customer',
            header: 'Cliente',
            headerClassName: 'w-full',
            stack: 'title' as const,
            cell: (agreement: RentalAgreement) => (
              <span className="text-body font-semibold">{agreement.customer.fullName}</span>
            ),
          },
        ]
      : []),
    {
      key: 'vehicle',
      header: 'Carro',
      className: 'whitespace-nowrap',
      ...(withCustomer ? {} : { stack: 'title' as const, headerClassName: 'w-full' }),
      cell: (agreement) => (
        <span className="flex flex-wrap items-center gap-2">
          {agreement.vehicle.plate === null ? null : (
            <PlateChip plate={agreement.vehicle.plate} size="sm" />
          )}
          <span className="text-text-dim text-dense">{vehicleTitle(agreement.vehicle)}</span>
        </span>
      ),
    },
    {
      key: 'when',
      header: 'Sale / regresa',
      className: 'whitespace-nowrap',
      cell: (agreement) => <WhenCell agreement={agreement} />,
    },
    {
      key: 'balance',
      header: 'Saldo',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (agreement) => <BalanceCell agreement={agreement} />,
    },
    {
      key: 'status',
      header: 'Estado',
      stack: 'aside',
      className: 'whitespace-nowrap',
      cell: (agreement) => <AgreementStatusStamp status={agreement.derivedStatus} />,
    },
  ];
}
