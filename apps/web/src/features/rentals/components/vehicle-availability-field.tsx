'use client';

import { AVAILABILITY_LABELS, rentalWhenLabel } from '@elite/shared';
import type { AvailabilityRow } from '@elite/shared';

import { Combobox } from '@/components/ui/combobox';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { FieldError } from '@/features/inventory/components/form-fields';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

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
  freeOnly = false,
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
  /** Alta (108): solo los libres, cada uno con su precio por día. */
  freeOnly?: boolean;
  error?: string;
}) {
  const range = from !== null && to !== null && to > from ? { from, to } : null;
  const availability = useAvailability(range);
  const rows = (availability.data ?? []).filter((row) => row.vehicle.id !== excludeVehicleId);
  const selected = rows.find((row) => row.vehicle.id === value);

  if (freeOnly) {
    const free = rows.filter((row) => row.availability === 'FREE');

    return (
      <div className="flex flex-col gap-2 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
        <p className="text-label text-text-dim font-semibold">{label}</p>
        {range === null ? (
          <p className="text-text-dim text-body">Elegí las fechas</p>
        ) : availability.isPending ? (
          <p className="text-text-dim text-body">Buscando…</p>
        ) : free.length === 0 ? (
          <p className="text-text-dim text-body">Nada libre</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {free.map((row) => {
              const picked = row.vehicle.id === value;

              return (
                <li key={row.vehicle.id}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    className={cn(
                      'border-line bg-surface flex min-h-(--touch-min) w-full items-center gap-3 rounded-row border px-3 py-2 text-left',
                      picked && 'border-flame bg-surface-2',
                    )}
                    onClick={() => onChange(row.vehicle.id, row)}
                  >
                    {row.vehicle.plate === null ? null : (
                      <PlateChip plate={row.vehicle.plate} size="sm" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">
                      {vehicleTitle(row.vehicle)}
                    </span>
                    <span className="text-text-dim shrink-0 text-dense tabular-nums">
                      {formatMoneyCompact(row.dailyRate)} por día
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
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
