'use client';

import type { InventoryItemOption } from '@elite/shared';
import { Lock, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { groupByCategory, optionsInCategory } from '@/features/carwash/product-browse';
import { centsToAmount, parseCents } from '@/lib/money';
import { formatQuantity, milliToQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import type { AccountProducts } from '../hooks/use-account-products';
import {
  canAddOne,
  isDiscounted,
  isOverStock,
  setUnitPrice,
  toMilli,
  type CartLine,
} from '../sale-cart';
import { QuantityStepper } from './quantity-stepper';
import { SalePriceDialog } from './sale-price-dialog';

/**
 * Los productos de «Nueva venta» como lista de filas (106): buscador, chips de
 * categoría y una fila por producto con su nombre, «Hay N», el precio y el `+`,
 * que al agregar se vuelve el `− N +`. Un agotado queda en gris con «Agotado» y
 * sin botón. Con algo escrito se busca en todas las categorías y los chips se
 * apartan.
 *
 * `canPrice` deja el candado del precio (060) en la fila elegida: solo al
 * cobrar ahora; a una cuenta se anota al precio del artículo (RN-4).
 *
 * El lector de código de barras teclea el número y un Enter: si la búsqueda
 * deja un solo producto, el Enter lo agrega y limpia el campo.
 */
export function SaleProductList({
  products,
  canPrice,
}: {
  products: AccountProducts;
  canPrice: boolean;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [pricingId, setPricingId] = useState<string | null>(null);
  const options = products.options.data ?? [];
  const searching = products.term.trim() !== '';
  const groups = searching ? [] : groupByCategory(options);
  const activeCategory =
    groups.find((group) => group.key === category)?.key ?? groups[0]?.key ?? null;
  const visible = searching
    ? options
    : activeCategory === null
      ? options
      : optionsInCategory(options, activeCategory);
  const pricingLine = products.lines.find((line) => line.itemId === pricingId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FieldBox>
        <Label htmlFor="sale-product-search">Buscar producto</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="sale-product-search"
            type="search"
            className="min-w-0 flex-1"
            value={products.term}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => products.setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') products.setTerm('');
              if (event.key !== 'Enter') return;

              event.preventDefault();

              const only = options.length === 1 ? options[0] : undefined;

              if (only === undefined) return;

              products.step(only, 1);
              products.setTerm('');
            }}
          />
          {products.term === '' ? null : (
            <button
              type="button"
              onClick={() => products.setTerm('')}
              aria-label="Borrar búsqueda"
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </div>
      </FieldBox>

      {groups.length > 1 ? (
        <div role="group" aria-label="Categorías" className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <FilterChip
              key={group.key}
              pressed={group.key === activeCategory}
              onClick={() => setCategory(group.key)}
            >
              {group.name}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {products.options.error ? (
        <p className="text-danger-text text-body" role="alert">
          {products.options.error.message}
        </p>
      ) : products.options.isPending ? (
        <p className="text-text-faint text-body py-2" role="status">
          Cargando…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-text-faint text-body py-2">
          {searching ? 'Sin resultados' : 'No hay productos a la venta'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((option) => (
            <ProductRow
              key={option.id}
              option={option}
              line={products.lines.find((line) => line.itemId === option.id)}
              onStep={(delta) => products.step(option, delta)}
              onSet={(milli) => products.setOptionQuantity(option, milli)}
              onPrice={canPrice ? () => setPricingId(option.id) : null}
            />
          ))}
        </ul>
      )}

      {pricingLine === null ? null : (
        <SalePriceDialog
          line={pricingLine}
          authorization={products.priceAuthorization}
          open
          onOpenChange={(next) => {
            if (!next) setPricingId(null);
          }}
          onApply={(unitPrice, signature) => {
            products.edit((previous) => setUnitPrice(previous, pricingLine.itemId, unitPrice));
            if (signature !== null) products.setPriceAuthorization(signature);
          }}
        />
      )}
    </div>
  );
}

/** Una unidad entera de lo que haya, sin ceros de más: «Hay 12». */
function stockLabel(milli: number): string {
  return `Hay ${formatQuantity(milliToQuantity(Math.max(0, milli)))}`;
}

/**
 * Una fila: nombre, «Hay N», precio y el control. Bajo 640px el precio y el
 * control bajan juntos a la derecha si el nombre no deja lugar. En la bahía la
 * fila, el nombre y el `− N +` suben de tamaño (`--row-h`, `--touch-min`).
 */
function ProductRow({
  option,
  line,
  onStep,
  onSet,
  onPrice,
}: {
  option: InventoryItemOption;
  line: CartLine | undefined;
  onStep: (delta: 1 | -1) => void;
  onSet: (milli: number) => void;
  /** El candado del precio, o `null` si no se puede cambiar. */
  onPrice: (() => void) | null;
}) {
  const stock = toMilli(option.stockOnHand);
  const quantity = line?.quantity ?? 0;
  const out = stock <= 0 && quantity === 0;
  const over = line !== undefined && isOverStock(line);
  const discounted = line !== undefined && isDiscounted(line);
  const price = line?.unitPrice ?? option.price;

  return (
    <li
      className={cn(
        'bg-surface flex min-h-row flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-row border py-1.5 pr-2 pl-(--field-px)',
        over
          ? 'border-danger'
          : quantity > 0
            ? 'border-[color-mix(in_oklab,var(--flame)_45%,var(--line))]'
            : 'border-line-soft',
      )}
    >
      <span
        className={cn(
          'min-w-36 flex-1 font-semibold [[data-density=bahia]_&]:text-title',
          out ? 'text-text-faint' : 'text-text',
        )}
      >
        {option.name}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-3.5">
        {out ? null : (
          <span
            className={cn(
              'text-dense tabular-nums',
              over ? 'text-danger-text font-semibold' : 'text-text-faint',
            )}
            role={over ? 'alert' : undefined}
          >
            {stockLabel(over ? stock : stock - quantity)}
          </span>
        )}

        <span className="flex min-w-16 items-baseline justify-end gap-1.5 tabular-nums">
          {discounted ? (
            <span className="text-text-faint is-ruled-out font-mono text-dense">
              ${centsToAmount(parseCents(option.price))}
            </span>
          ) : null}
          <span className={cn('font-mono font-semibold', out ? 'text-text-faint' : 'text-text')}>
            ${centsToAmount(parseCents(price))}
          </span>
        </span>

        <span className="flex min-w-[calc(var(--touch-min)*2+3.5rem)] items-center justify-end gap-1">
          {out ? (
            <Stamp tone="neutral" label="Agotado" />
          ) : quantity > 0 ? (
            <>
              <QuantityStepper
                name={option.name}
                quantity={quantity}
                canAdd={line !== undefined && canAddOne(line)}
                onStep={onStep}
                onSet={onSet}
              />
              {onPrice === null ? null : (
                <button
                  type="button"
                  onClick={onPrice}
                  aria-label={`Cambiar el precio de ${option.name}`}
                  title="Cambiar el precio (pide autorización)"
                  className={cn(
                    'hover:bg-surface-2 grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard',
                    discounted ? 'text-warn-text' : 'text-text-faint hover:text-text',
                  )}
                >
                  <Lock aria-hidden strokeWidth={1.5} className="size-icon" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label={`Agregar ${option.name}`}
              className="border-line bg-surface-2 text-text hover:border-flame grid size-touch shrink-0 cursor-pointer place-items-center rounded-control border transition-colors duration-(--duration-state) ease-standard"
            >
              <Plus aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </span>
      </span>
    </li>
  );
}
