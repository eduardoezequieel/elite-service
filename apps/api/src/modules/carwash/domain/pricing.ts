import type { Cents } from './money';

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

/** Una linea ya resuelta: lo que se cobra y de cuanto venia. */
export interface PricedItem {
  catalogPrice: Cents;
  unitPrice: Cents;
}

/**
 * Total del ticket: la suma de lo que se cobra por cada linea (RN-6).
 *
 * No hay cantidades distintas de 1 en v1, asi que una linea es un servicio. El
 * IVA ya viene incluido en cada precio (RN-14), asi que esto es el total que se
 * cobra, no una base imponible.
 */
export function totalOf(items: readonly PricedItem[]): Cents {
  return items.reduce((sum, item) => sum + item.unitPrice, 0);
}

/** Cuanto se descontó respecto del catalogo. Cero si no hubo descuento. */
export function discountOf(items: readonly PricedItem[]): Cents {
  return items.reduce((sum, item) => sum + (item.catalogPrice - item.unitPrice), 0);
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
