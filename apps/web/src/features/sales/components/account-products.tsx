'use client';

import { Lock, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AccountProducts } from '../hooks/use-account-products';
import {
  canAddOne,
  formatQuantity,
  formulaLabel,
  isDiscounted,
  isOverStock,
  ONE_UNIT,
  removeLine,
  setQuantity,
  setUnitPrice,
  type CartLine,
} from '../sale-cart';
import { ProductSearch } from './product-search';
import { QuantityStepper } from './quantity-stepper';
import { SalePriceDialog } from './sale-price-dialog';

/**
 * El buscador de productos sueltos de una cuenta (065, 066), atado al borrador
 * de `useAccountProducts`. Lo usan «Nueva venta» y el cobro del lavado.
 */
export function AccountProductSearch({ products }: { products: AccountProducts }) {
  return (
    <ProductSearch
      term={products.term}
      onTermChange={products.setTerm}
      options={products.options.data ?? []}
      isLoading={products.options.isPending}
      errorMessage={products.options.error?.message ?? null}
      lines={products.lines}
      onStep={products.step}
      onSet={products.setOptionQuantity}
    />
  );
}

/**
 * Lo que la cuenta lleva de productos sueltos: `2 × $3.00 = $6.00`, el `− +`,
 * el candado del precio (060) y quitar. Si una línea pide más de lo que hay, lo
 * dice en rojo con «Hay N». Una sola firma cubre todas las líneas rebajadas.
 */
export function AccountProductLines({
  products,
  emptyHint = 'Usá el + de un producto para agregarlo.',
}: {
  products: AccountProducts;
  emptyHint?: string;
}) {
  const [pricingId, setPricingId] = useState<string | null>(null);
  const { lines, edit, priceAuthorization } = products;
  const pricingLine = lines.find((line) => line.itemId === pricingId) ?? null;

  return (
    <>
      {lines.length === 0 ? (
        <div className="py-2">
          <p className="text-text font-semibold">Todavía no hay productos</p>
          <p className="text-text-faint text-dense">{emptyHint}</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {lines.map((line) => (
            <CartLineRow
              key={line.itemId}
              line={line}
              authorizer={priceAuthorization?.authorization.email.trim() ?? ''}
              reason={priceAuthorization?.reason ?? ''}
              onStep={(delta) =>
                edit((previous) =>
                  setQuantity(previous, line.itemId, line.quantity + delta * ONE_UNIT),
                )
              }
              onSet={(milli) => edit((previous) => setQuantity(previous, line.itemId, milli))}
              onPrice={() => setPricingId(line.itemId)}
              onRemove={() => edit((previous) => removeLine(previous, line.itemId))}
            />
          ))}
        </ul>
      )}

      {pricingLine === null ? null : (
        <SalePriceDialog
          line={pricingLine}
          authorization={priceAuthorization}
          open
          onOpenChange={(next) => {
            if (!next) setPricingId(null);
          }}
          onApply={(unitPrice, signature) => {
            edit((previous) => setUnitPrice(previous, pricingLine.itemId, unitPrice));
            if (signature !== null) products.setPriceAuthorization(signature);
          }}
        />
      )}
    </>
  );
}

function CartLineRow({
  line,
  authorizer,
  reason,
  onStep,
  onSet,
  onPrice,
  onRemove,
}: {
  line: CartLine;
  authorizer: string;
  reason: string;
  onStep: (delta: 1 | -1) => void;
  onSet: (milli: number) => void;
  onPrice: () => void;
  onRemove: () => void;
}) {
  const over = isOverStock(line);
  const discounted = isDiscounted(line);

  return (
    <li className="border-line-soft flex min-h-(--row-h) flex-wrap items-center gap-x-3 gap-y-2 border-b py-2 last:border-b-0">
      <span className="flex min-w-[11rem] flex-1 flex-col">
        <span className="text-text font-semibold [[data-density=bahia]_&]:text-title">
          {line.name}
        </span>
        <span className={cn('text-dense', over ? 'text-danger-text' : 'text-text-faint')}>
          {over ? (
            <b className="font-semibold">
              Hay {formatQuantity(line.stock, line.unit)}: bajá la cantidad
            </b>
          ) : discounted ? (
            <span className="text-warn-text inline-flex items-center gap-1">
              <Lock aria-hidden strokeWidth={1.5} className="size-3.5 shrink-0" />
              {authorizer === '' ? 'Falta la firma' : `Autoriza ${authorizer}`}
              {reason.trim() === '' ? '' : ` · ${reason.trim()}`}
            </span>
          ) : (
            `Precio del catálogo · hay ${formatQuantity(line.stock, line.unit)}`
          )}
        </span>
      </span>

      <span className="flex items-baseline gap-2 font-mono tabular-nums">
        {discounted ? (
          <span className="text-text-faint is-ruled-out text-dense">${line.catalogPrice}</span>
        ) : null}
        <span className="text-text-dim whitespace-nowrap">{formulaLabel(line)}</span>
      </span>

      <span className="flex items-center gap-1.5">
        <QuantityStepper
          name={line.name}
          quantity={line.quantity}
          canAdd={canAddOne(line)}
          onStep={onStep}
          onSet={onSet}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Cambiar el precio de ${line.name}`}
          title="Cambiar el precio (pide autorización)"
          onClick={onPrice}
        >
          <Lock aria-hidden strokeWidth={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Quitar ${line.name} de la cuenta`}
          onClick={onRemove}
        >
          <X aria-hidden strokeWidth={1.5} />
        </Button>
      </span>
    </li>
  );
}
