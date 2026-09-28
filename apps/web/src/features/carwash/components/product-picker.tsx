'use client';

import type { InventoryItemOption } from '@elite/shared';
import { Minus, Plus, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { centsToAmount, parseCents } from '@/lib/money';
import { useProductOptions } from '../hooks/use-product-options';
import {
  categoryChips,
  groupByCategory,
  optionsInCategory,
  type CategoryChip,
} from '../product-browse';
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

/**
 * El bloque «Productos» del lavado (065, 085): va debajo del selector de
 * servicios (050) en el alta y en la edición, en oficina y en la pista.
 *
 * Sin escribir no hay lista: solo los chips de categoría. Un toque en un chip
 * abre sus productos y otro lo cierra; si se escribe, se busca en todas y los
 * resultados salen agrupados por categoría. El numerito naranja del chip dice
 * cuánto llevás de ella.
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
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const term = useDebouncedValue(search).trim();
  // La lista entera arma los chips y sirve de respaldo para lo ya elegido que
  // la búsqueda no trae: sin ella, esa fila se quedaría sin «Hay N».
  const all = useProductOptions(scope, searchProducts, '');
  const found = useProductOptions(scope, searchProducts, term, term !== '');
  const searching = term !== '';
  const results = searching ? found : all;

  const optionOf = (id: string): InventoryItemOption | undefined =>
    results.data?.find((option) => option.id === id) ??
    all.data?.find((option) => option.id === id);

  const picked = new Set(value.map((pick) => pick.inventoryItemId));
  const notPicked = (options: readonly InventoryItemOption[] | undefined) =>
    (options ?? []).filter((option) => !picked.has(option.id));
  const chips = categoryChips(all.data ?? [], value);
  const catalogEmpty = all.data !== undefined && all.data.length === 0;

  function step(option: Pick<InventoryItemOption, 'id' | 'name' | 'price'>, delta: number): void {
    onChange(stepProduct(value, option, delta));
  }

  function clearSearch(): void {
    setSearch('');
  }

  function toggleCategory(key: string): void {
    // Tocar un chip con búsqueda escrita la borra: la categoría manda.
    if (search !== '') {
      clearSearch();
      setOpenCategory(key);
      return;
    }

    setOpenCategory((current) => (current === key ? null : key));
  }

  function optionRow(option: InventoryItemOption): ReactNode {
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
  }

  function below(): ReactNode {
    if (results.isPending) {
      return <p className="text-text-dim text-body">Cargando productos…</p>;
    }

    if (results.error) {
      return (
        <p className="text-danger-text text-dense" role="alert">
          {results.error.message}
        </p>
      );
    }

    if (searching) {
      const groups = groupByCategory(notPicked(found.data));

      if (groups.length === 0) {
        return (
          <p className="text-text-dim text-body">
            Nada con «{term}». Probá con otra palabra o tocá una categoría.
          </p>
        );
      }

      return (
        <>
          <Hint>Buscando en todas las categorías.</Hint>
          {groups.map((group) => (
            <div key={group.key} className="grid gap-2.5">
              <p className="text-text-faint mx-0.5 mt-1.5 text-label">{group.name}</p>
              {group.options.map(optionRow)}
            </div>
          ))}
        </>
      );
    }

    if (catalogEmpty) {
      return value.length === 0 ? (
        <p className="text-text-dim text-body">No hay productos a la venta todavía.</p>
      ) : null;
    }

    if (openCategory !== null) {
      const options = optionsInCategory(notPicked(all.data), openCategory);

      return options.length === 0 ? (
        <Hint>Ya elegiste todo lo de esta categoría.</Hint>
      ) : (
        options.map(optionRow)
      );
    }

    return value.length === 0 ? <Hint>Tocá una categoría o buscá por nombre.</Hint> : null;
  }

  const rest = below();

  return (
    <div className="grid gap-2.5">
      <FieldBox>
        <Label htmlFor={`${idPrefix}-product-search`}>Buscar producto</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id={`${idPrefix}-product-search`}
            className="min-w-0 flex-1"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cera, aromatizante, INV-0002…"
            autoComplete="off"
            enterKeyHint="search"
            disabled={disabled}
            onKeyDown={(event) => {
              // Enter busca, no manda el formulario del lavado.
              if (event.key === 'Enter') event.preventDefault();
              if (event.key === 'Escape') clearSearch();
            }}
          />
          {search === '' ? null : (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Borrar búsqueda"
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </div>
      </FieldBox>

      {chips.length === 0 ? null : (
        <div role="group" aria-label="Categorías de productos" className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <CategoryChipButton
              key={chip.key}
              chip={chip}
              pressed={!searching && openCategory === chip.key}
              muted={searching}
              disabled={disabled}
              onToggle={() => toggleCategory(chip.key)}
            />
          ))}
        </div>
      )}

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

      {value.length > 0 && rest !== null ? (
        <div role="presentation" className="bg-line-soft my-1 h-px" />
      ) : null}

      {rest}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-text-faint mx-0.5 mt-0.5 text-dense">{children}</p>;
}

/**
 * Un chip de categoría: nombre, cuántos productos tiene y, si llevás algo de
 * ella, el numerito naranja. `aria-pressed` y el filete de llama marcan el
 * abierto; el número no depende del color para leerse. Mide `--touch-min`, así
 * que en la bahía sube solo a 44px.
 */
function CategoryChipButton({
  chip,
  pressed,
  muted,
  disabled,
  onToggle,
}: {
  chip: CategoryChip;
  pressed: boolean;
  /** Con búsqueda escrita, los chips no presionados se atenúan. */
  muted: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'text-text inline-flex min-h-(--touch-min) cursor-pointer items-center gap-2 rounded-full border-(length:--selectable-border) px-3.5 font-semibold',
        'transition-[border-color,background-color,opacity] duration-(--duration-state) ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-55',
        '[[data-density=bahia]_&]:px-5',
        pressed
          ? 'border-flame bg-flame/12'
          : cn('border-line bg-surface-2 hover:border-text-faint', muted && 'opacity-55'),
      )}
    >
      {chip.name}
      <span className="text-text-faint text-dense font-medium tabular-nums">{chip.total}</span>
      {chip.picked > 0 ? (
        <span
          aria-label={`${quantityLabel(chip.picked)} elegidos`}
          className="gradient-action grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-(length:--count-size) font-bold text-white tabular-nums"
        >
          {quantityLabel(chip.picked)}
        </span>
      ) : null}
    </button>
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
        <span className="text-text block font-semibold [[data-density=bahia]_&]:text-title">
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
