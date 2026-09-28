'use client';

import type { Ticket, TicketItem } from '@elite/shared';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/ui/stamp';
import { centsToAmount, parseCents } from '@/lib/money';
import { isProductLine, lineQuantityLabel, toMilli } from '../product-lines';

/**
 * Una línea del lavado —servicio o producto (065)—, con su precio bajo llave (060).
 *
 * Mientras el lavado está abierto el precio se teclea en el alta y en la
 * edición, como siempre. Desde que queda listo —y en la caja— acá se muestra
 * como **texto**, nunca como un control muerto, y al lado va el candado que
 * abre el diálogo de autorización. Sin `onChangePrice` no hay candado: la línea
 * es solo de lectura.
 *
 * El precio del catálogo aparece tachado solo cuando el cobrado es otro: si
 * estuviera siempre sería ruido en el 90% de las filas. La firma «Autorizó X»
 * va debajo del nombre y solo con la firma puesta: una rebaja hecha con el
 * lavado abierto no la lleva, porque no la autorizó nadie.
 *
 * Un producto se lee con su cantidad: debajo del nombre `2 × $3.00` y a la
 * derecha el total de la línea. El candado es el mismo y cambia el precio
 * **por unidad** (065 RN-7); el catálogo tachado va dentro de la fórmula, al
 * lado del unitario, que es el que se tocó.
 */
export function TicketItemLine({
  item,
  onChangePrice,
}: {
  item: TicketItem;
  /** Si viene, se dibuja el candado «Cambiar precio». */
  onChangePrice?: () => void;
}) {
  const changed = parseCents(item.unitPrice) !== parseCents(item.catalogPrice);
  const signedBy = item.priceAuthorizedBy;
  const product = isProductLine(item);

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-text text-body">{item.name}</span>
        {product ? (
          <span className="text-text-dim flex flex-wrap items-baseline gap-x-1.5 font-mono text-dense tabular-nums">
            {changed ? (
              <span className="text-text-faint is-ruled-out">
                ${centsToAmount(parseCents(item.catalogPrice))}
              </span>
            ) : null}
            <span>{lineQuantityLabel(item.unitPrice, toMilli(item.quantity))}</span>
          </span>
        ) : null}
        {signedBy === null ? null : (
          <span className="text-warn-text text-dense flex items-center gap-1.5">
            <Lock aria-hidden strokeWidth={1.5} className="size-3.5 shrink-0" />
            Autorizó {signedBy.fullName}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        {changed && !product ? (
          <span className="text-text-faint is-ruled-out text-dense">${item.catalogPrice}</span>
        ) : null}
        <span className="text-text text-body">${product ? item.total : item.unitPrice}</span>
        {onChangePrice === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onChangePrice}
            aria-label={
              product
                ? `Cambiar el precio por unidad de ${item.name}`
                : `Cambiar el precio de ${item.name}`
            }
            title="Cambiar precio"
          >
            <Lock aria-hidden strokeWidth={1.5} />
          </Button>
        )}
      </span>
    </div>
  );
}

/**
 * Las líneas de un lavado, como se leen en el detalle, la pista y la cuenta:
 * primero los servicios y, si hay, los productos bajo su propio rótulo (065).
 * Sin `onChangePrice` son solo de lectura.
 */
export function TicketLines({
  items,
  onChangePrice,
}: {
  items: readonly TicketItem[];
  /** Si viene, cada línea lleva su candado (060). */
  onChangePrice?: (item: TicketItem) => void;
}) {
  const services = items.filter((item) => !isProductLine(item));
  const products = items.filter(isProductLine);

  return (
    <>
      {services.map((item) => (
        <TicketItemLine
          key={item.id}
          item={item}
          onChangePrice={onChangePrice === undefined ? undefined : () => onChangePrice(item)}
        />
      ))}
      {products.length === 0 ? null : (
        <>
          <p className="text-text-faint text-label mt-1">Productos</p>
          {products.map((item) => (
            <TicketItemLine
              key={item.id}
              item={item}
              onChangePrice={onChangePrice === undefined ? undefined : () => onChangePrice(item)}
            />
          ))}
        </>
      )}
    </>
  );
}

/** `true` si alguna línea del lavado lleva firma de autorización (060). */
export function hasAuthorizedPrice(ticket: Pick<Ticket, 'items'>): boolean {
  return ticket.items.some((item) => item.priceAuthorizedBy !== null);
}

/**
 * La insignia del lavado con un precio firmado. Ámbar como el resto de lo que
 * pide atención, y con la palabra escrita: el color nunca dice solo.
 */
export function AuthorizedPriceStamp() {
  return (
    <Stamp tone="amber" label="Precio autorizado" icon={<Lock strokeWidth={1.5} />} pulse={false} />
  );
}
