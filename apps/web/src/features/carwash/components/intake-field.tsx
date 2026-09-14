'use client';

import type { Customer, VehicleWithOwner } from '@elite/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { cn } from '@/lib/utils';
import { useIntakeSearch } from '../hooks/use-intake-search';
import { formatPlate } from '../hooks/use-vehicle-search';

/** Lo que se puede elegir de la lista. */
type Option =
  | { kind: 'vehicle'; vehicle: VehicleWithOwner }
  | { kind: 'customer'; customer: Customer }
  | { kind: 'new' };

/** ¿Lo tecleado tiene forma de placa? Una o dos letras y en seguida un número. */
function looksLikePlate(term: string): boolean {
  return /^[A-Za-z]{1,2}\d/.test(term.replace(/[\s-]/g, ''));
}

/**
 * La caja del alta: se escribe la placa (040).
 *
 * Las coincidencias se tocan: no se eligen solas. La última fila siempre es
 * «Es un carro nuevo». Si lo escrito no coincide con nadie y ya parece una
 * placa, se pasa solo a anotar el carro nuevo.
 */
export function IntakeField({
  value,
  onChange,
  scope,
  searchCustomers,
  onPickVehicle,
  onPickCustomer,
  onNewVehicle,
}: {
  value: string;
  onChange: (next: string) => void;
  /** De qué API salen los resultados: `carwash` en oficina, `floor` en la pista. */
  scope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  onPickVehicle: (vehicle: VehicleWithOwner) => void;
  onPickCustomer: (customer: Customer) => void;
  /** Anotar un carro que no está: recibe lo tecleado si parecía una placa. */
  onNewVehicle: (plate: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [highlighted, setHighlighted] = useState(-1);
  const openedNew = useRef(false);
  const search = useIntakeSearch(scope, value, searchCustomers, isOpen);

  const plateLike = looksLikePlate(value);

  const options = useMemo<Option[]>(() => {
    const exact = search.exactPlate;
    const vehicles =
      exact === null
        ? search.vehicles
        : [exact, ...search.vehicles.filter((candidate) => candidate.id !== exact.id)];

    return [...vehicles.map((vehicle): Option => ({ kind: 'vehicle', vehicle })), { kind: 'new' }];
  }, [search.exactPlate, search.vehicles]);

  const found = options.length - 1;
  const showList = isOpen && !search.tooShort;
  const compact = value.replace(/[\s-]/g, '');

  useEffect(() => {
    if (openedNew.current) return;
    if (search.tooShort || search.isPending) return;
    if (search.vehicles.length > 0) return;
    if (compact.length < 4 || !looksLikePlate(value)) return;

    openedNew.current = true;
    onNewVehicle(formatPlate(value));
  }, [
    compact.length,
    onNewVehicle,
    search.isPending,
    search.tooShort,
    search.vehicles.length,
    value,
  ]);

  function take(option: Option | undefined): void {
    if (option === undefined) return;

    setIsOpen(false);
    setHighlighted(-1);

    if (option.kind === 'vehicle') onPickVehicle(option.vehicle);
    else if (option.kind === 'customer') onPickCustomer(option.customer);
    else onNewVehicle(plateLike ? formatPlate(value) : '');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setHighlighted(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setHighlighted((current) => Math.min(current + 1, options.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, -1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted >= 0) take(options[highlighted]);
    }
  }

  return (
    <div data-slot="intake-field-root" className="relative">
      <FieldBox>
        <Label htmlFor="intake-search">Placa</Label>
        <Input
          id="intake-search"
          value={value}
          onChange={(event) => {
            onChange(formatPlate(event.target.value));
            setIsOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="text-headline h-auto py-0.5 font-mono tracking-[0.08em]"
          placeholder="P000-000"
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="search"
          maxLength={10}
          role="combobox"
          aria-expanded={showList}
          aria-controls="intake-results"
          aria-autocomplete="list"
        />
      </FieldBox>

      {showList ? (
        <div
          id="intake-results"
          role="listbox"
          aria-label="Resultados"
          className="border-line bg-surface-2 divide-line-soft absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[22rem] divide-y overflow-y-auto rounded-row border"
        >
          <p className="bg-surface-3 text-text-faint text-label px-4 py-1.5">
            {search.isPending
              ? 'Buscando…'
              : found === 0
                ? 'Nada encontrado'
                : `${found} coincidencia${found === 1 ? '' : 's'}`}
          </p>

          {options.map((option, index) => {
            const isOn = index === highlighted;
            const key =
              option.kind === 'vehicle'
                ? option.vehicle.id
                : option.kind === 'customer'
                  ? option.customer.id
                  : 'new';

            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={isOn}
                onPointerDown={(event) => {
                  event.preventDefault();
                  take(option);
                }}
                onClick={() => take(option)}
                onMouseEnter={() => setHighlighted(index)}
                className={cn(
                  'min-h-touch hover:bg-surface-3 flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-(--duration-state) ease-standard',
                  isOn && 'bg-surface-3',
                )}
              >
                {option.kind === 'vehicle' ? <VehicleRow vehicle={option.vehicle} /> : null}
                {option.kind === 'customer' ? <CustomerRow customer={option.customer} /> : null}
                {option.kind === 'new' ? (
                  <NewRow plate={plateLike ? formatPlate(value) : ''} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Un carro conocido: la placa, cómo es y de quién es, en una sola línea. */
function VehicleRow({ vehicle }: { vehicle: VehicleWithOwner }) {
  const makeAndColor = [vehicle.make, vehicle.color].filter(Boolean).join(' ');

  return (
    <>
      <PlateChip plate={vehicle.plate} />

      <span className="min-w-0 flex-1">
        <span className="text-text block truncate font-semibold">
          {makeAndColor === '' ? vehicle.bodyType.name : makeAndColor}
        </span>
        <span className="text-text-faint text-dense block truncate">{vehicle.bodyType.name}</span>
      </span>

      <span className="min-w-0 shrink-0 text-right">
        <span className="text-text block truncate text-dense font-semibold">
          {vehicle.currentOwner?.fullName ?? 'Sin responsable'}
        </span>
        <span className="text-text-faint block font-mono text-dense">
          {vehicle.currentOwner?.phone ?? '—'}
        </span>
      </span>
    </>
  );
}

/** Una persona: se elige cuando el carro no se encontró por placa. */
function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="text-text block truncate font-semibold">{customer.fullName}</span>
        <span className="text-text-faint text-dense block">Cliente registrado</span>
      </span>

      <span className="text-text-faint shrink-0 font-mono text-dense">
        {customer.phone ?? 'Sin teléfono'}
      </span>
    </>
  );
}

/** La salida de la lista: anotar un carro que el sistema no conoce. */
function NewRow({ plate }: { plate: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="text-flame-text grid size-7 shrink-0 place-items-center rounded-control border border-dashed border-[color-mix(in_oklab,var(--flame)_55%,var(--line))] text-body leading-none"
      >
        +
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-flame-text block truncate font-semibold">
          Es un carro nuevo{plate === '' ? '' : ` · ${plate}`}
        </span>
        <span className="text-text-faint text-dense block">Anotarlo desde cero</span>
      </span>
    </>
  );
}
