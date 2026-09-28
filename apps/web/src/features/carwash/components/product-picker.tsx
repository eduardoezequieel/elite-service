'use client';

import type { InventoryItemOption } from '@elite/shared';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { centsToAmount, parseCents } from '@/lib/money';
import { useProductOptions } from '../hooks/use-product-options';
import {
  ONE_UNIT,
  availableAfter,
  lineFormula,
  quantityLabel,
  quantityOf,
  quantityWithUnit,
  stepProduct,
  type ProductPick,
  type StockShortage,
} from '../product-lines';

/** Sin buscar, cuántos productos no elegidos se muestran antes de pedir que se busque. */
const BROWSE_LIMIT = 8;

/**
 * El bloque «Productos» del lavado (065): va debajo del selector de servicios
 * (050) en el alta y en la edición, en oficina y en la pista.
 *
 * Un producto es una fila con su nombre, «Hay N», el precio y el `− 1 +`. Lo
 * elegido queda siempre arriba —aunque la búsqueda ya no lo traiga— con su
 * fórmula `2 × $3.00 = $6.00`, y debajo lo que se puede sumar. Un producto va
 * una sola vez, con su cantidad (RN-9); no hay regla de uno por rubro.
 *
 * Nada de costos: la opción que llega del API ya viene sin ellos (RN-17), así
 * que la pista ve exactamente este mismo bloque.
 *
 * El `+` se apaga cuando no queda más; el API igual vuelve a validar y, si en
 * el medio alguien se llevó el último, responde `409 INSUFFICIENT_STOCK`: esa
 * fila se marca con lo que de verdad hay y el formulario no se pierde.
 */
export function ProductPicker({
  scope,
  searchProducts,
  value,
  onChange,
  original = {},
  shortage = null,
  idPrefix,
  disabled = false,
}: {
  /** Encabeza la clave de la consulta: `carwash` en oficina, `floor` en la pista. */
  scope: string;
  searchProducts: (search: string) => Promise<InventoryItemOption[]>;
  value: readonly ProductPick[];
  onChange: (next: ProductPick[]) => void;
  /** Lo que el lavado ya tenía apartado, por artículo (edición). */
  original?: Readonly<Record<string, number>>;
  /** El faltante del último `409 INSUFFICIENT_STOCK`, si sigue vigente. */
  shortage?: StockShortage | null;
  /** Para que los `id` no choquen si hay dos bloques en la misma página. */
  idPrefix: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search).trim();
  // La lista entera sirve de respaldo para lo ya elegido que la búsqueda no
  // trae: sin ella, esa fila se quedaría sin «Hay N». Con el buscador vacío
  // las dos consultas son la misma y viaja una sola.
  const all = useProductOptions(scope, searchProducts, '');
  const found = useProductOptions(scope, searchProducts, term, term !== '');
  const results = term === '' ? all : found;

  const optionOf = (id: string): InventoryItemOption | undefined =>
    results.data?.find((option) => option.id === id) ??
    all.data?.find((option) => option.id === id);

  const picked = new Set(value.map((pick) => pick.inventoryItemId));
  const rest = (results.data ?? []).filter((option) => !picked.has(option.id));
  const shown = term === '' ? rest.slice(0, BROWSE_LIMIT) : rest;
  const hidden = rest.length - shown.length;

  function step(option: Pick<InventoryItemOption, 'id' | 'name' | 'price'>, delta: number): void {
    onChange(stepProduct(value, option, delta));
  }

  return (
    <div className="grid gap-2.5">
      <FieldBox>
        <Label htmlFor={`${idPrefix}-product-search`}>Buscar producto</Label>
        <Input
          id={`${idPrefix}-product-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cera, aromatizante…"
          autoComplete="off"
          enterKeyHint="search"
          disabled={disabled}
          onKeyDown={(event) => {
            // Enter busca, no manda el formulario del lavado.
            if (event.key === 'Enter') event.preventDefault();
          }}
        />
      </FieldBox>

      {value.map((pick) => {
        const option = optionOf(pick.inventoryItemId);
        const selected = pick.quantity;
        const mine = original[pick.inventoryItemId] ?? 0;
        const short = shortage?.itemId === pick.inventoryItemId ? shortage : null;
        const left =
          short !== null
            ? short.available - selected
            : option === undefined
              ? // Sin la opción a la vista (inactivo, o la lista no llegó) solo
                // se puede bajar hasta lo que el lavado ya tenía.
                mine - selected
              : availableAfter(option.stockOnHand, mine, selected);

        return (
          <ProductRow
            key={pick.inventoryItemId}
            name={pick.name}
            code={option?.code ?? null}
            price={pick.unitPrice}
            catalogPrice={pick.catalogPrice}
            quantity={selected}
            stockLabel={
              short !== null
                ? `Hay ${quantityWithUnit(short.available, option?.unit ?? '')} · bajá la cantidad`
                : option === undefined
                  ? all.isPending
                    ? 'Buscando existencia…'
                    : 'Ya no está a la venta'
                  : left <= 0
                    ? 'No hay más'
                    : `Hay ${quantityWithUnit(left, option.unit)}`
            }
            isShort={short !== null}
            canAdd={!disabled && left >= ONE_UNIT}
            disabled={disabled}
            onStep={(delta) =>
              step({ id: pick.inventoryItemId, name: pick.name, price: pick.catalogPrice }, delta)
            }
          />
        );
      })}

      {shown.map((option) => {
        const mine = original[option.id] ?? 0;
        const left = availableAfter(option.stockOnHand, mine, quantityOf(value, option.id));

        return (
          <ProductRow
            key={option.id}
            name={option.name}
            code={option.code}
            price={option.price}
            catalogPrice={option.price}
            quantity={0}
            stockLabel={left <= 0 ? 'Sin existencia' : `Hay ${quantityWithUnit(left, option.unit)}`}
            isShort={false}
            canAdd={!disabled && left >= ONE_UNIT}
            disabled={disabled}
            onStep={(delta) => step(option, delta)}
          />
        );
      })}

      {results.isPending ? (
        <p className="text-text-dim text-body">Cargando productos…</p>
      ) : results.error ? (
        <p className="text-danger-text text-dense" role="alert">
          {results.error.message}
        </p>
      ) : rest.length === 0 && value.length === 0 ? (
        <p className="text-text-dim text-body">
          {term === ''
            ? 'No hay productos a la venta todavía.'
            : `Nada con «${term}». Probá con otra palabra.`}
        </p>
      ) : hidden > 0 ? (
        <p className="text-text-faint text-dense">
          {hidden === 1 ? 'Hay 1 producto más' : `Hay ${hidden} productos más`}: buscalo por nombre.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Una fila del bloque. Bajo 900px el precio y el `− +` bajan juntos a la
 * derecha si el nombre no deja lugar: el nombre nunca se aplasta contra el
 * contador.
 *
 * El `− +` mide `--touch-min` (36px en mostrador, 44px en la bahía) y la fila
 * `--row-h`; en la bahía el número además sube de tamaño, que es lo que se lee
 * con la tablet en la mano.
 */
function ProductRow({
  name,
  code,
  price,
  catalogPrice,
  quantity,
  stockLabel,
  isShort,
  canAdd,
  disabled,
  onStep,
}: {
  name: string;
  /** `INV-0001`, secundario al nombre. `null` si la opción no está a la vista. */
  code: string | null;
  /** Lo que se cobra por unidad. */
  price: string;
  catalogPrice: string;
  quantity: number;
  stockLabel: string;
  isShort: boolean;
  canAdd: boolean;
  disabled: boolean;
  onStep: (delta: number) => void;
}) {
  const on = quantity > 0;
  const rebated = parseCents(price) !== parseCents(catalogPrice);

  return (
    <div
      className={cn(
        'min-h-row flex flex-wrap items-center gap-x-3 gap-y-2 rounded-row border-(length:--selectable-border) px-(--field-px) py-2',
        'bg-surface-2 transition-colors duration-(--duration-state) ease-standard',
        isShort
          ? 'border-danger'
          : on
            ? 'border-[color-mix(in_oklab,var(--flame)_45%,var(--line))]'
            : 'border-line',
      )}
    >
      <span className="min-w-[10rem] flex-1">
        <span className="text-text block font-semibold">
          {name}
          {code === null ? null : (
            <span className="text-text-faint ml-1.5 font-mono text-dense font-normal">{code}</span>
          )}
        </span>
        <span
          className={cn(
            'block text-dense',
            isShort ? 'text-danger-text font-semibold' : 'text-text-faint',
          )}
          role={isShort ? 'alert' : undefined}
        >
          {stockLabel}
        </span>
        {on ? (
          <span className="text-text-dim block font-mono text-dense tabular-nums">
            {lineFormula(price, quantity)}
          </span>
        ) : null}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className="flex items-baseline gap-1.5 tabular-nums">
          {rebated ? (
            <span className="text-text-faint is-ruled-out font-mono text-dense">
              ${centsToAmount(parseCents(catalogPrice))}
            </span>
          ) : null}
          <span className="text-text font-mono text-body font-bold">
            ${centsToAmount(parseCents(price))}
          </span>
        </span>

        <span
          role="group"
          aria-label={`Cantidad de ${name}`}
          className={cn(
            'bg-surface inline-flex items-center overflow-hidden rounded-control border',
            on ? 'border-flame' : 'border-line',
          )}
        >
          <button
            type="button"
            onClick={() => onStep(-ONE_UNIT)}
            disabled={disabled || !on}
            aria-label={`Quitar uno de ${name}`}
            className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center transition-colors duration-(--duration-state) ease-standard disabled:cursor-not-allowed disabled:bg-transparent"
          >
            <Minus aria-hidden strokeWidth={1.5} className="size-icon" />
          </button>
          <span
            aria-live="polite"
            className="text-text min-w-9 text-center font-mono text-body font-bold tabular-nums [[data-density=bahia]_&]:min-w-11 [[data-density=bahia]_&]:text-title"
          >
            {quantityLabel(quantity)}
          </span>
          <button
            type="button"
            onClick={() => onStep(ONE_UNIT)}
            disabled={!canAdd}
            aria-label={`Agregar uno de ${name}`}
            title={canAdd ? undefined : 'No hay más existencia'}
            className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center transition-colors duration-(--duration-state) ease-standard disabled:cursor-not-allowed disabled:bg-transparent"
          >
            <Plus aria-hidden strokeWidth={1.5} className="size-icon" />
          </button>
        </span>
      </span>
    </div>
  );
}
