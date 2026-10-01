'use client';

import { AVAILABILITY_LABELS, rentalWhenLabel } from '@elite/shared';
import type { AvailabilityRow } from '@elite/shared';

import { Combobox } from '@/components/ui/combobox';
import { Stamp } from '@/components/ui/stamp';
import { FieldError } from '@/features/inventory/components/form-fields';
import { formatMoney } from '@/lib/money';
import { AVAILABILITY_TONES, vehicleTitle } from '../agreement-format';
import { useAvailability } from '../hooks/use-agreements';

/** La línea de apoyo de un carro en la lista: disponibilidad, tarifa y quién lo tiene. */
export function availabilityHint(row: AvailabilityRow): string {
  const parts = [AVAILABILITY_LABELS[row.availability], `${formatMoney(row.dailyRate)}/día`];

  if (row.blocking !== null) {
    parts.push(
      row.availability === 'FREE_IF_RETURNED'
        ? `${row.blocking.customerName} lo devuelve ${rentalWhenLabel(row.blocking.plannedReturnAt)}`
        : `${row.blocking.customerName} hasta ${rentalWhenLabel(row.blocking.plannedReturnAt)}`,
    );
  }

  return parts.join(' · ');
}

/**
 * El carro de una renta, con la disponibilidad en vivo del rango (096): libre,
 * libre si regresa a tiempo u ocupado. Sin rango completo no pregunta.
 */
export function VehicleAvailabilityField({
  id,
  label = 'Carro',
  from,
  to,
  value,
  onChange,
  excludeVehicleId,
  error,
}: {
  id: string;
  label?: string;
  /** Instantes ISO; `null` mientras la fecha no está completa. */
  from: string | null;
  to: string | null;
  value: string;
  onChange: (vehicleId: string, row: AvailabilityRow | undefined) => void;
  /** El carro que ya tiene la renta, en un cambio o una reasignación. */
  excludeVehicleId?: string;
  error?: string;
}) {
  const range = from !== null && to !== null && to > from ? { from, to } : null;
  const availability = useAvailability(range);
  const rows = (availability.data ?? []).filter((row) => row.vehicle.id !== excludeVehicleId);
  const selected = rows.find((row) => row.vehicle.id === value);

  const options = rows.map((row) => ({
    value: row.vehicle.id,
    label: `${vehicleTitle(row.vehicle)} · ${row.vehicle.plate ?? 'sin placa'}`,
    meta: row.vehicle.plate ?? undefined,
    hint: availabilityHint(row),
  }));

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
      <Combobox
        id={id}
        label={label}
        options={options}
        value={value}
        disabled={range === null}
        placeholder={
          range === null
            ? 'Elegí primero las fechas'
            : availability.isPending
              ? 'Buscando qué hay libre…'
              : 'Elegí el carro'
        }
        emptyText="No hay carros disponibles para rentar."
        onChange={(next) =>
          onChange(
            next,
            rows.find((row) => row.vehicle.id === next),
          )
        }
        invalid={error !== undefined}
      />
      {selected === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <Stamp
            label={AVAILABILITY_LABELS[selected.availability]}
            tone={AVAILABILITY_TONES[selected.availability]}
          />
          <span className="text-text-dim text-dense">{availabilityHint(selected)}</span>
        </div>
      )}
      {availability.error === null ? null : (
        <p className="text-danger-text text-dense" role="alert">
          {availability.error.message}
        </p>
      )}
      <FieldError message={error} />
    </div>
  );
}
