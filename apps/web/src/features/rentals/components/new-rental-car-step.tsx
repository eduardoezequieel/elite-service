'use client';

import { FLEET_CATEGORY_LABELS, fleetVehicleName } from '@elite/shared';
import type { AvailabilityRow, FleetVehicleCategory } from '@elite/shared';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DateRangeField } from '@/components/ui/date-field';
import { FieldBox } from '@/components/ui/field-box';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Stamp } from '@/components/ui/stamp';
import { TimePickerField } from '@/components/ui/time-picker-field';
import { FleetCarImage } from '@/features/fleet/components/fleet-car-image';
import type { CivilRange } from '@/lib/civil-date';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

import { AVAILABILITY_TONES } from '../agreement-format';
import { rangeLabel } from '../available-range';
import { freeCars, returnsChip } from '../new-rental';

/** Un título de pregunta del asistente (`q-label` del prototipo). */
export function StepLabel({ children }: { children: string }) {
  return <p className="text-text-dim mb-2 text-body font-semibold">{children}</p>;
}

/**
 * Paso 1 · Carro (118): el rango en el calendario sin atajos, las dos horas
 * lado a lado y los carros libres del rango con su total.
 */
export function NewRentalCarStep({
  now,
  pickupAt,
  returnAt,
  rangeValid,
  onRange,
  onPickupTime,
  onReturnTime,
  vehicleId,
  onVehicle,
  rows,
  loading,
  error,
}: {
  /** Ahora (`nowField`): ni el día ni la hora de salida pueden quedar antes. */
  now: string;
  pickupAt: string;
  returnAt: string;
  rangeValid: boolean;
  onRange: (range: CivilRange) => void;
  onPickupTime: (time: string) => void;
  onReturnTime: (time: string) => void;
  vehicleId: string;
  onVehicle: (row: AvailabilityRow) => void;
  rows: readonly AvailabilityRow[];
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FleetVehicleCategory | ''>('');

  const allFree = freeCars(rows, '', '');
  const categories = [...new Set(allFree.map((row) => row.vehicle.category))];
  const activeCategory = category !== '' && categories.includes(category) ? category : '';
  const shown = freeCars(rows, query, activeCategory);

  return (
    <>
      <div>
        <StepLabel>Fechas</StepLabel>
        <div className="flex">
          <DateRangeField
            value={{ from: pickupAt.slice(0, 10), to: returnAt.slice(0, 10) }}
            triggerLabel={rangeLabel({ from: pickupAt, to: returnAt })}
            presets={[]}
            min={now.slice(0, 10)}
            onChange={onRange}
            aria-label="Fechas"
          />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <TimePickerField
            id="new-rental-pickup-time"
            label="Hora de salida"
            value={pickupAt.slice(11, 16)}
            min={pickupAt.slice(0, 10) === now.slice(0, 10) ? now.slice(11, 16) : undefined}
            onChange={onPickupTime}
          />
          <TimePickerField
            id="new-rental-return-time"
            label="Hora de regreso"
            value={returnAt.slice(11, 16)}
            onChange={onReturnTime}
          />
        </div>
      </div>

      <div>
        <StepLabel>Carro</StepLabel>
        {!rangeValid ? (
          <p className="text-danger-text text-body" role="alert">
            Revise las fechas
          </p>
        ) : loading ? (
          <ListSkeleton rows={3} label="Buscando lo libre" />
        ) : error !== null ? (
          <p className="text-danger-text text-body" role="alert">
            {error}
          </p>
        ) : (
          <>
            {allFree.length === 0 ? null : (
              <div className="mb-3 flex flex-col gap-2.5">
                <SearchBox
                  id="new-rental-car-search"
                  label="Buscar carro"
                  value={query}
                  onChange={setQuery}
                  placeholder="Placa o modelo"
                />
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    pressed={activeCategory === ''}
                    count={allFree.length}
                    onClick={() => setCategory('')}
                  >
                    Todos
                  </FilterChip>
                  {categories.map((candidate) => (
                    <FilterChip
                      key={candidate}
                      pressed={activeCategory === candidate}
                      count={allFree.filter((row) => row.vehicle.category === candidate).length}
                      onClick={() => setCategory(candidate)}
                    >
                      {FLEET_CATEGORY_LABELS[candidate]}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}
            {shown.length === 0 ? (
              <p className="text-text-dim text-body">
                {allFree.length === 0 ? 'Nada libre' : 'Sin resultados'}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {shown.map((row) => (
                  <li key={row.vehicle.id}>
                    <CarPick row={row} picked={row.vehicle.id === vehicleId} onPick={onVehicle} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Buscador con la etiqueta adentro y ✕ para borrar cuando hay texto. */
export function SearchBox({
  id,
  label,
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <FieldBox className={cn('min-w-0', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
        <Input
          id={id}
          type="search"
          className="min-w-0 flex-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          data-keeps-escape={value === '' ? undefined : true}
        />
        {value === '' ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mr-2 shrink-0"
            onClick={() => {
              onChange('');
              document.getElementById(id)?.focus();
            }}
          >
            <X className="size-icon" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Borrar búsqueda</span>
          </Button>
        )}
      </div>
    </FieldBox>
  );
}

/**
 * Una fila elegible: radio, miniatura 3D, placa, nombre y el total del rango.
 * Si el carro sigue en la calle, el chip ámbar dice cuándo vuelve.
 */
function CarPick({
  row,
  picked,
  onPick,
}: {
  row: AvailabilityRow;
  picked: boolean;
  onPick: (row: AvailabilityRow) => void;
}) {
  const { vehicle } = row;
  const returns = returnsChip(row);

  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={() => onPick(row)}
      className={cn(
        'border-line bg-surface-2 flex min-h-(--row-h) w-full items-center gap-3 rounded-control border-(length:--selectable-border) px-4 py-2.5 text-left',
        'transition-[border-color,background-color] duration-(--duration-state) ease-standard hover:border-flame/55',
        picked && 'border-flame bg-surface-3',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'border-line size-4.5 shrink-0 rounded-full border-2 transition-[border-width,border-color] duration-(--duration-state) ease-standard',
          picked && 'border-flame border-[6px]',
        )}
      />
      <FleetCarImage
        vehicle={vehicle}
        className="h-11 w-20 shrink-0 [[data-density=bahia]_&]:h-14 [[data-density=bahia]_&]:w-24"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {vehicle.plate === null && returns === null ? null : (
          <span className="flex flex-wrap items-center gap-1.5">
            {vehicle.plate === null ? null : <PlateChip plate={vehicle.plate} size="sm" />}
            {returns === null ? null : (
              <Stamp label={returns} tone={AVAILABILITY_TONES[row.availability]} />
            )}
          </span>
        )}
        <span className="truncate text-body font-semibold">{fleetVehicleName(vehicle)}</span>
      </span>
      <span className="font-display text-text shrink-0 text-title font-bold whitespace-nowrap italic tabular-nums">
        {formatMoneyCompact(row.estimatedTotal)}
      </span>
    </button>
  );
}
