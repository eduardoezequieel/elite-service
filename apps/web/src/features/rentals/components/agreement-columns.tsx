'use client';

import { rentalWhenLabel } from '@elite/shared';
import type { RentalAgreement } from '@elite/shared';

import type { DataTableColumn } from '@/components/ui/data-table';
import { PlateChip } from '@/components/ui/plate-chip';
import { referenceVariants } from '@/components/ui/reference';
import { FleetCarImage } from '@/features/fleet/components/fleet-car-image';
import { formatContractNumber } from '@/features/rental-documents/print-layout';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { agreementDays, agreementWhen, isNegativeAmount, vehicleTitle } from '../agreement-format';
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

/** El carro de una fila (117): miniatura 3D, placa y nombre. */
function CarCell({ vehicle }: { vehicle: RentalAgreement['vehicle'] }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        className="bg-surface-2 h-(--thumb-h) w-(--thumb-w) shrink-0 overflow-hidden rounded-control px-1 pt-0.5 [&_svg]:size-icon"
        aria-hidden
      >
        <FleetCarImage vehicle={vehicle} className="size-full" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {vehicle.plate === null ? null : <PlateChip plate={vehicle.plate} size="sm" />}
        <span className="text-body font-semibold">{vehicleTitle(vehicle)}</span>
      </span>
    </span>
  );
}

/** «Cuándo» (117): arriba qué pasa, abajo la fecha exacta. */
function WhenFactCell({ agreement, now }: { agreement: RentalAgreement; now: Date }) {
  const when = agreementWhen(agreement, now);

  return (
    <span className="flex flex-col tabular-nums">
      <span className={cn('font-semibold', when.alert ? 'text-danger-text' : 'text-text')}>
        {when.headline}
      </span>
      <span className="text-text-dim text-dense">{when.detail}</span>
    </span>
  );
}

/** El tab Rentas (117): carro con miniatura, cliente y «Cuándo». */
export function operationColumns(now: Date): DataTableColumn<RentalAgreement>[] {
  return [
    {
      key: 'vehicle',
      header: 'Carro',
      stack: 'title',
      headerClassName: 'w-full',
      cell: (agreement) => <CarCell vehicle={agreement.vehicle} />,
    },
    {
      key: 'customer',
      header: 'Cliente',
      className: 'whitespace-nowrap',
      cell: (agreement) => agreement.customer.fullName,
    },
    {
      key: 'when',
      header: 'Cuándo',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (agreement) => <WhenFactCell agreement={agreement} now={now} />,
    },
  ];
}

/** La referencia del Historial (117): «#0741», o «Sin contrato» en gris. */
export function contractReference(agreement: RentalAgreement) {
  return agreement.contractNumber === null ? (
    <span className="text-text-faint text-dense whitespace-nowrap">Sin contrato</span>
  ) : (
    <span className={referenceVariants()}>#{formatContractNumber(agreement.contractNumber)}</span>
  );
}

/** El Historial (117): carro, cliente, fechas y total; la cancelada lleva su sello. */
export function historyColumns(): DataTableColumn<RentalAgreement>[] {
  return [
    {
      key: 'vehicle',
      header: 'Carro',
      stack: 'title',
      headerClassName: 'w-full',
      cell: (agreement) => <CarCell vehicle={agreement.vehicle} />,
    },
    {
      key: 'customer',
      header: 'Cliente',
      className: 'whitespace-nowrap',
      cell: (agreement) => agreement.customer.fullName,
    },
    {
      key: 'dates',
      header: 'Fechas',
      className: 'whitespace-nowrap tabular-nums',
      cell: (agreement) => agreementDays(agreement),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (agreement) =>
        agreement.status === 'CANCELLED' ? (
          <AgreementStatusStamp status="CANCELLED" />
        ) : (
          <span className="font-mono tabular-nums">{formatMoney(agreement.totals.total)}</span>
        ),
    },
  ];
}

/**
 * Las columnas del historial del cliente (096).
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
