'use client';

import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { formatQuantity, maskQuantityInput, toMilli } from '../sale-cart';

/**
 * El `− N +` de un producto (065).
 *
 * Los botones suman o restan una unidad entera; el número del medio se puede
 * teclear para lo que se vende por litro (tres decimales, RN-16). Al salir del
 * campo se entrega en milésimas y la pantalla lo recorta a lo que hay. Los dos
 * botones y el campo miden `--touch-min`: en `bahia` suben solos a 44px.
 */
export function QuantityStepper({
  name,
  quantity,
  canAdd,
  onStep,
  onSet,
  disabledAdd = false,
}: {
  /** Para las etiquetas: «Agregar uno de Cera en pasta». */
  name: string;
  /** En milésimas. Cero si todavía no está en la venta. */
  quantity: number;
  /** El `+` se apaga cuando ya no hay más. */
  canAdd: boolean;
  onStep: (delta: 1 | -1) => void;
  /** Si viene, el número del medio se puede teclear. */
  onSet?: (milli: number) => void;
  disabledAdd?: boolean;
}) {
  const shown = formatQuantity(quantity);
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(shown);
  }, [shown, editing]);

  const buttonClass = cn(
    'text-text grid size-(--touch-min) shrink-0 cursor-pointer place-items-center',
    'transition-colors duration-(--duration-state) ease-standard hover:bg-surface-2',
    'disabled:text-text-faint disabled:cursor-not-allowed disabled:hover:bg-transparent',
  );

  return (
    <div
      role="group"
      aria-label={`Cantidad de ${name}`}
      className={cn(
        'bg-surface inline-flex shrink-0 items-center overflow-hidden rounded-control border',
        quantity > 0 ? 'border-flame' : 'border-line',
      )}
    >
      <button
        type="button"
        className={buttonClass}
        disabled={quantity <= 0}
        aria-label={`Quitar uno de ${name}`}
        onClick={() => onStep(-1)}
      >
        <Minus aria-hidden strokeWidth={1.5} className="size-icon" />
      </button>

      {onSet === undefined ? (
        <span
          aria-live="polite"
          className="text-text min-w-9 text-center font-mono font-semibold tabular-nums [[data-density=bahia]_&]:min-w-11 [[data-density=bahia]_&]:text-title"
        >
          {shown}
        </span>
      ) : (
        <input
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Cantidad de ${name}`}
          className="text-text h-(--touch-min) w-14 bg-transparent text-center font-mono font-semibold tabular-nums outline-none focus-visible:bg-surface-2 [[data-density=bahia]_&]:w-16 [[data-density=bahia]_&]:text-title"
          value={draft}
          onFocus={(event) => {
            setEditing(true);
            event.target.select();
          }}
          onChange={(event) => setDraft(maskQuantityInput(event.target.value))}
          onBlur={() => {
            setEditing(false);
            onSet(toMilli(draft));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      )}

      <button
        type="button"
        className={buttonClass}
        disabled={!canAdd || disabledAdd}
        aria-label={`Agregar uno de ${name}`}
        onClick={() => onStep(1)}
      >
        <Plus aria-hidden strokeWidth={1.5} className="size-icon" />
      </button>
    </div>
  );
}
