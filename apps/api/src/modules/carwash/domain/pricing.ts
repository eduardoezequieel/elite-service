import type { Milli } from '../../inventory/domain/stock';
import type { Cents } from './money';
import type { WorkOrderStatus } from './work-order';

/** Una unidad, en milesimas: la cantidad de toda linea de servicio (065 RN-6). */
export const ONE_UNIT: Milli = 1000;

/**
 * Precio de catalogo y descuento (RN-2, RN-3, RN-5).
 *
 * Reglas puras: sin Prisma, sin NestJS. Lo que entra ya viene resuelto desde la
 * base; lo que sale es una decision.
 */

/** Una fila de la matriz: cuanto cuesta un servicio para un tipo de carro. */
export interface BodyTypePrice {
  bodyTypeId: string;
  price: Cents;
}

/** Lo que el dominio necesita saber de un servicio para poder cotizarlo. */
export interface PriceableService {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  /** Precio base, con IVA incluido (RN-2). Es el de sedan en el seed. */
  defaultPrice: Cents;
  /** Filas de la matriz. Vacia es valido: el servicio usa siempre el base (RN-3). */
  prices: BodyTypePrice[];
}

/**
 * El precio de catalogo de un servicio para un tipo de carro (RN-2).
 *
 * Si existe fila en la matriz para ese tipo, gana la fila. Si no, gana el base.
 * **Una celda vacia no es cero: es "usar el base".** Es la diferencia entre un
 * aromatizante que cuesta $2 en cualquier carro y uno que seria gratis en
 * camioneta.
 */
export function catalogPriceFor(service: PriceableService, bodyTypeId: string): Cents {
  const row = service.prices.find((price) => price.bodyTypeId === bodyTypeId);

  return row?.price ?? service.defaultPrice;
}

/** Por que un precio pedido no se puede aplicar. */
export type PriceRejection = 'ABOVE_CATALOG' | 'NEGATIVE';

/**
 * Valida el precio que se quiere cobrar por una linea (RN-5).
 *
 * El descuento solo **baja**: el piso es 0 y el techo es el precio de catalogo
 * que se copio al agregar la linea. Que el techo sea el snapshot y no el
 * catalogo de hoy es deliberado (RN-4): si el catalogo sube manana, un ticket
 * abierto ayer no se vuelve "descontado" de golpe.
 *
 * Devuelve `null` si el precio es valido, o el motivo del rechazo.
 */
export function rejectPrice(unitPrice: Cents, catalogPrice: Cents): PriceRejection | null {
  if (unitPrice < 0) return 'NEGATIVE';
  if (unitPrice > catalogPrice) return 'ABOVE_CATALOG';

  return null;
}

/** Una linea ya resuelta: lo que se cobra por unidad, de cuanto venia y cuantas. */
export interface PricedItem {
  catalogPrice: Cents;
  unitPrice: Cents;
  /** En milesimas. Ausente = una unidad, que es lo que lleva todo servicio (065 RN-6). */
  quantity?: Milli;
}

/**
 * `precio × cantidad` de una linea, en centavos (065 RN-6).
 *
 * El precio viene en centavos y la cantidad en milesimas, asi que el producto
 * esta en «centavos × 1000» y se redondea al centavo con mitad hacia arriba:
 * 3 × $0.335 no existe, pero 0.5 l × $2.25 = $1.125 → $1.13. Se hace con
 * `bigint` para que ningun producto grande pase por el flotante.
 */
export function lineTotal(unitPrice: Cents, quantity: Milli = ONE_UNIT): Cents {
  const scaled = BigInt(unitPrice) * BigInt(quantity);
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const rounded = (absolute + 500n) / 1000n;

  return Number(negative ? -rounded : rounded);
}

/**
 * Total del ticket: la suma de lo que se cobra por cada linea (RN-6).
 *
 * Cada linea es `unitPrice × quantity` redondeado al centavo (065 RN-6); un
 * servicio lleva una unidad y queda igual que antes. El IVA ya viene incluido
 * en cada precio (RN-14), asi que esto es el total que se cobra, no una base
 * imponible.
 */
export function totalOf(items: readonly PricedItem[]): Cents {
  return items.reduce((sum, item) => sum + lineTotal(item.unitPrice, item.quantity), 0);
}

/** Cuanto se descontó respecto del catalogo. Cero si no hubo descuento. */
export function discountOf(items: readonly PricedItem[]): Cents {
  return items.reduce(
    (sum, item) =>
      sum +
      (lineTotal(item.catalogPrice, item.quantity) - lineTotal(item.unitPrice, item.quantity)),
    0,
  );
}

/**
 * Recalcula las lineas cuando cambia el tipo de carro de un ticket `OPEN`
 * (RN-4).
 *
 * Solo se mueven las que **todavia estan al precio de catalogo**: si alguien ya
 * le hizo un descuento a una linea, ese descuento es una decision de una persona
 * y no se pisa. La linea descontada conserva su `unitPrice` y actualiza su techo
 * al catalogo nuevo, porque el techo describe al servicio, no al descuento.
 *
 * Si el techo nuevo queda por debajo del precio descontado, gana el techo: la
 * linea no puede quedar cobrando por encima del catalogo (RN-5).
 */
export function repriceForBodyType(
  items: readonly (PricedItem & { service: PriceableService | null })[],
  bodyTypeId: string,
): PricedItem[] {
  return items.map((item) => {
    if (item.service === null)
      return { catalogPrice: item.catalogPrice, unitPrice: item.unitPrice };

    const catalogPrice = catalogPriceFor(item.service, bodyTypeId);
    const wasAtCatalogPrice = item.unitPrice === item.catalogPrice;

    return {
      catalogPrice,
      unitPrice: wasAtCatalogPrice ? catalogPrice : Math.min(item.unitPrice, catalogPrice),
    };
  });
}

/**
 * Hasta cuando el precio se puede tocar sin autorizacion (060 RN-1).
 *
 * Mientras el lavado esta abierto o lavandose, recepcion cotiza: baja el precio
 * de una linea y listo, que es lo que hace falta con el cliente enfrente. Desde
 * que queda listo —caja incluida— el precio se cierra y solo lo cambia la firma
 * de alguien con `carwash.discount`.
 */
export function isPriceOpen(status: WorkOrderStatus): boolean {
  return status === 'OPEN' || status === 'WASHING';
}

/**
 * `true` si el alta o la edicion estan intentando escribir un precio distinto
 * al de catalogo sobre un lavado que ya cerro el precio (060 RN-1).
 *
 * Se mide contra el catalogo y no contra el precio anterior a proposito: una
 * linea ya autorizada que vuelve a guardarse con el mismo precio rebajado
 * tambien necesita firma, porque el camino del alta no la pide.
 */
export function needsPriceAuthorization(
  status: WorkOrderStatus,
  items: readonly PricedItem[],
): boolean {
  return !isPriceOpen(status) && items.some((item) => item.unitPrice !== item.catalogPrice);
}
