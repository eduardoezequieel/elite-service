'use client';

import type { InventoryItemOption } from '@elite/shared';
import { Search } from 'lucide-react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatQuantityWithUnit, milliToQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import { canAddOne, toMilli, type CartLine } from '../sale-cart';
import { QuantityStepper } from './quantity-stepper';

/** Cuántos productos se muestran a la vez. Más que eso se afina escribiendo. */
const VISIBLE_LIMIT = 12;

/**
 * El buscador de productos de la venta suelta (065): nombre, código o código
 * de barras, con su precio, «Hay N» y el `− +`.
 *
 * El lector de código de barras teclea el número y un Enter: si la búsqueda
 * deja un solo producto, el Enter lo agrega y limpia el campo para el
 * siguiente.
 */
export function ProductSearch({
  term,
  onTermChange,
  options,
  isLoading,
  errorMessage,
  lines,
  onStep,
  onSet,
}: {
  term: string;
  onTermChange: (value: string) => void;
  options: readonly InventoryItemOption[];
  isLoading: boolean;
  errorMessage: string | null;
  lines: readonly CartLine[];
  onStep: (option: InventoryItemOption, delta: 1 | -1) => void;
  onSet: (option: InventoryItemOption, milli: number) => void;
}) {
  const visible = options.slice(0, VISIBLE_LIMIT);
  const hidden = options.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      <FieldBox>
        <Label htmlFor="sale-product-search">Buscar producto</Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="sale-product-search"
            className="min-w-0 flex-1"
            value={term}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
            onChange={(event) => onTermChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;

              event.preventDefault();

              const only = options.length === 1 ? options[0] : undefined;

              if (only === undefined) return;

              onStep(only, 1);
              onTermChange('');
            }}
          />
        </div>
      </FieldBox>

      {errorMessage === null ? null : (
        <p className="text-danger-text text-body" role="alert">
          {errorMessage}
        </p>
      )}

      {isLoading ? (
        <p className="text-text-faint text-dense py-2">Cargando…</p>
      ) : visible.length === 0 && errorMessage === null ? (
        <div className="py-3">
          <p className="text-text font-semibold">
            {term.trim() === '' ? 'No hay productos a la venta' : 'Nada con ese nombre'}
          </p>
          <p className="text-text-faint text-dense">
            {term.trim() === ''
              ? 'Los productos se dan de alta en Inventario.'
              : 'Probá con el código (INV-0001) o el código de barras.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((option) => (
            <ProductRow
              key={option.id}
              option={option}
              line={lines.find((line) => line.itemId === option.id)}
              onStep={(delta) => onStep(option, delta)}
              onSet={(milli) => onSet(option, milli)}
            />
          ))}
        </ul>
      )}

      {hidden > 0 ? (
        <p className="text-text-faint text-dense">
          Hay {hidden} {hidden === 1 ? 'producto más' : 'productos más'}: afiná la búsqueda.
        </p>
      ) : null}
    </div>
  );
}

function ProductRow({
  option,
  line,
  onStep,
  onSet,
}: {
  option: InventoryItemOption;
  line: CartLine | undefined;
  onStep: (delta: 1 | -1) => void;
  onSet: (milli: number) => void;
}) {
  const stock = toMilli(option.stockOnHand);
  const quantity = line?.quantity ?? 0;
  const out = stock <= 0;
  const full = line !== undefined && !canAddOne({ quantity, stock });

  return (
    <li
      className={cn(
        'flex min-h-(--row-h) flex-wrap items-center gap-3 rounded-row border px-(--field-px) py-2',
        quantity > 0 ? 'border-flame bg-flame/10' : 'border-line bg-surface-2',
      )}
    >
      <span className="flex min-w-[11rem] flex-1 flex-col">
        <span className="text-text font-semibold [[data-density=bahia]_&]:text-title">
          {option.name}
          <span className="text-text-faint ml-1.5 font-mono text-dense font-normal">
            {option.code}
          </span>
        </span>
        <span className="text-text-faint text-dense">
          {out ? (
            <span className="text-danger-text">Sin existencia</span>
          ) : (
            <>
              Hay {formatQuantityWithUnit(milliToQuantity(stock), option.unit)}
              {full ? <span className="text-danger-text"> · no hay más</span> : null}
            </>
          )}
        </span>
      </span>
      <span className="text-text min-w-16 text-right font-mono tabular-nums">${option.price}</span>
      <QuantityStepper
        name={option.name}
        quantity={quantity}
        canAdd={!out && (line === undefined || canAddOne({ quantity, stock }))}
        onStep={onStep}
        onSet={out ? undefined : onSet}
      />
    </li>
  );
}
