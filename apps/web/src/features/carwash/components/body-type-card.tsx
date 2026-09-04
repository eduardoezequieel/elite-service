'use client';

import type { ServiceDetail, VehicleBodyType } from '@elite/shared';
import { useRef } from 'react';

import { cn } from '@/lib/utils';
import { BODY_TYPE_MODELS, VehicleIcon, bodyTypeShapeOf } from './vehicle-icons';

/**
 * El precio más barato del catálogo para este tipo de carro.
 *
 * Es el «desde $X» de la tarjeta: sale de la matriz real (RN-2), no de una
 * tabla inventada. Si todavía no cargó el catálogo no se inventa nada: guion.
 */
function fromPriceOf(bodyTypeId: string, services: ServiceDetail[]): string {
  const prices = services
    .map((service) => {
      const match = service.prices.find((price) => price.bodyTypeId === bodyTypeId);

      return Number(match?.price ?? service.defaultPrice);
    })
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) return '—';

  const min = Math.min(...prices);

  return `desde $${Number.isInteger(min) ? min : min.toFixed(2)}`;
}

/**
 * El grupo de tipos de carro: un `radiogroup` de verdad.
 *
 * Se toca con el dedo y se recorre con las flechas —izquierda/arriba y
 * derecha/abajo—, con foco itinerante: solo la tarjeta elegida entra en el
 * orden de tabulación (la primera si todavía no hay ninguna), que es lo que
 * espera un lector de pantalla de un grupo de radios.
 */
export function BodyTypePicker({
  bodyTypes,
  services,
  value,
  onChange,
}: {
  bodyTypes: VehicleBodyType[];
  services: ServiceDetail[];
  value: string;
  onChange: (bodyTypeId: string) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const selectedIndex = bodyTypes.findIndex((bodyType) => bodyType.id === value);
  const rovingIndex = selectedIndex === -1 ? 0 : selectedIndex;

  return (
    <div
      ref={group}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      role="radiogroup"
      aria-label="Tipo de vehículo"
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;

        if (step === 0 || bodyTypes.length === 0) return;

        event.preventDefault();

        const next = (rovingIndex + step + bodyTypes.length) % bodyTypes.length;

        onChange(bodyTypes[next].id);
        group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
      }}
    >
      {bodyTypes.map((bodyType, index) => (
        <BodyTypeCard
          key={bodyType.id}
          bodyType={bodyType}
          services={services}
          selected={bodyType.id === value}
          tabbable={index === rovingIndex}
          onSelect={() => onChange(bodyType.id)}
        />
      ))}
    </div>
  );
}

/**
 * Una tarjeta de tipo de carro.
 *
 * Silueta, nombre, el «desde $X» real y los modelos de ejemplo. El nombre
 * conserva el mismo peso elegido o no, para que la rejilla no salte al tocarla;
 * lo que cambia es el filete, el tinte y la palomita de la esquina.
 */
function BodyTypeCard({
  bodyType,
  services,
  selected,
  tabbable,
  onSelect,
}: {
  bodyType: VehicleBodyType;
  services: ServiceDetail[];
  selected: boolean;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const shape = bodyTypeShapeOf(bodyType.key, bodyType.name);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-row border-[1.5px] p-4 text-center select-none',
        'min-h-touch transition-colors duration-(--duration-state) ease-standard',
        selected
          ? 'border-flame bg-[color-mix(in_oklab,var(--flame)_12%,transparent)]'
          : 'border-line bg-surface-2 hover:border-text-faint',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-flame text-primary-foreground absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.3l2.4 2.4 4.6-5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <VehicleIcon
        bodyTypeKey={bodyType.key}
        bodyTypeName={bodyType.name}
        className={cn(
          'h-7 w-auto transition-colors duration-(--duration-state) ease-standard',
          selected ? 'text-flame' : 'text-text-faint',
        )}
      />

      <span className="text-text text-body leading-tight font-semibold">{bodyType.name}</span>

      <span className="text-text-dim text-dense leading-tight tabular-nums">
        {fromPriceOf(bodyType.id, services)}
      </span>

      <span className="text-text-faint text-label leading-tight font-normal">
        {BODY_TYPE_MODELS[shape]}
      </span>
    </button>
  );
}
