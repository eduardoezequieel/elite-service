import { API_ERROR_CODES, isProductTicketItem, isServiceTicketItem } from '@elite/shared';
import type {
  ProductTicketItemInput,
  ServiceDetail,
  ServiceTicketItemInput,
  TicketItemInput,
} from '@elite/shared';

import { ConflictError, ValidationError } from '../../../common/errors/application-error';
import { expandCombo } from '../../combos/domain/combo-pricing';
import { fromQuantityString } from '../../inventory/domain/stock';
import {
  ONE_UNIT,
  catalogPriceFor,
  rejectPrice,
  rejectServicePrice,
  type PriceableService,
} from '../domain/pricing';
import { toCents, toDecimalString } from '../domain/money';
import type { TicketComboRecord } from './ports/combo-catalog';
import type { InventoryProductRecord } from './ports/inventory-catalog';
import type { TicketItemData } from './ports/ticket.repository';

/** Una linea de servicio tal como la pide el cliente del API. */
export type RequestedItem = ServiceTicketItemInput;

/** Ids de los productos pedidos, sin repetir: lo que hay que buscar en el inventario. */
export function productIdsOf(items: readonly TicketItemInput[]): string[] {
  return [...new Set(items.filter(isProductTicketItem).map((item) => item.inventoryItemId))];
}

/** Traduce el contrato del catalogo a lo que entiende el dominio de precios. */
function toPriceable(service: ServiceDetail): PriceableService {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    isActive: service.isActive,
    defaultPrice: toCents(service.defaultPrice),
    prices: service.prices.map((price) => ({
      bodyTypeId: price.bodyTypeId,
      price: toCents(price.price),
    })),
  };
}

/**
 * Convierte las lineas pedidas en lineas listas para guardar, resolviendo
 * precio de catalogo y validando el descuento (RN-2, RN-4, RN-5).
 *
 * Es el unico lugar donde se decide cuanto cuesta una linea, y esta compartido
 * por las dos entradas —pista y oficina— a proposito: si cada una calculara lo
 * suyo, tarde o temprano cobrarian distinto por lo mismo.
 *
 * Cada linea copia `serviceCode`, `serviceName`, `catalogPrice`, `unitPrice` y
 * `taxRate`. Ese snapshot es lo que hace que cambiar el catalogo manana no
 * reescriba los tickets de ayer (RN-4).
 *
 * Un ticket lleva los servicios que quiera, aunque sean del mismo rubro
 * (111, reemplaza 039 RN-1): cada uno es su linea con su precio. Lo que no
 * existe es el mismo servicio dos veces en el mismo pedido.
 */
export function buildTicketItems(
  requested: readonly RequestedItem[],
  catalog: readonly ServiceDetail[],
  bodyTypeId: string,
): TicketItemData[] {
  const byId = new Map(catalog.map((service) => [service.id, service]));
  const seen = new Set<string>();

  return requested.map((item, index) => {
    const service = byId.get(item.serviceId);

    if (service === undefined || !service.isActive) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese servicio no existe o está desactivado.',
        details: { serviceId: item.serviceId },
      });
    }

    if (seen.has(service.id)) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: `«${service.name}» ya está en el lavado.`,
        details: { serviceId: service.id },
      });
    }

    seen.add(service.id);

    const catalogPrice = catalogPriceFor(toPriceable(service), bodyTypeId);
    const unitPrice = item.unitPrice === undefined ? catalogPrice : toCents(item.unitPrice);

    // Un servicio sube o baja: solo el piso de 0 (087).
    if (rejectServicePrice(unitPrice) === 'NEGATIVE') {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El precio no puede ser negativo.',
        details: { serviceId: item.serviceId },
      });
    }

    return {
      kind: 'SERVICE',
      serviceId: service.id,
      inventoryItemId: null,
      serviceCode: service.code,
      serviceName: service.name,
      catalogPrice,
      unitPrice,
      quantity: ONE_UNIT,
      taxRate: service.taxRate,
      sortOrder: index,
      comboId: null,
      comboName: null,
    };
  });
}

/**
 * Las lineas de producto (065 RN-6, RN-7, RN-9), con el mismo snapshot que un
 * servicio mas la cantidad: codigo, nombre, `catalogPrice` (el precio del
 * articulo hoy), `unitPrice` e IVA. Un producto tiene un solo precio, sin
 * matriz por tipo de carro.
 *
 * Como los servicios (111), un lavado lleva los productos que quiera, pero
 * cada uno **una vez**, con su cantidad (RN-9).
 *
 * Que un producto este activo y tenga existencia no se decide aca sino en el
 * kardex, con la fila bloqueada y solo si la cantidad sube: una linea que ya
 * estaba y no cambia sigue valiendo aunque el articulo se haya desactivado
 * despues (RN-14).
 */
export function buildProductItems(
  requested: readonly ProductTicketItemInput[],
  products: readonly InventoryProductRecord[],
): TicketItemData[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const seen = new Set<string>();

  return requested.map((item, index) => {
    const product = byId.get(item.inventoryItemId);

    if (product === undefined) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese producto no existe.',
        details: { inventoryItemId: item.inventoryItemId },
      });
    }

    if (product.kind !== 'PRODUCT') {
      throw new ConflictError({
        code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
        message: `«${product.name}» es un insumo: no se vende.`,
        details: { itemId: product.id },
      });
    }

    if (seen.has(product.id)) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: `«${product.name}» ya está en el lavado: cambiá la cantidad.`,
        details: { inventoryItemId: product.id },
      });
    }

    seen.add(product.id);

    const catalogPrice = product.price;
    const unitPrice = item.unitPrice === undefined ? catalogPrice : toCents(item.unitPrice);
    const rejection = rejectPrice(unitPrice, catalogPrice);

    if (rejection === 'ABOVE_CATALOG') {
      throw new ValidationError({
        code: API_ERROR_CODES.PRICE_ABOVE_CATALOG,
        message: 'El precio no puede ser mayor al del producto. El descuento solo baja.',
        details: { inventoryItemId: product.id, catalogPrice: toDecimalString(catalogPrice) },
      });
    }

    if (rejection === 'NEGATIVE') {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'El precio no puede ser negativo.',
        details: { inventoryItemId: product.id },
      });
    }

    return {
      kind: 'PRODUCT',
      serviceId: null,
      inventoryItemId: product.id,
      serviceCode: product.code,
      serviceName: product.name,
      catalogPrice,
      unitPrice,
      quantity: fromQuantityString(item.quantity),
      taxRate: product.taxRate,
      sortOrder: index,
      comboId: null,
      comboName: null,
    };
  });
}

/**
 * Todas las lineas de un pedido, servicios y productos, en el orden en que
 * llegaron: ese orden es el `sortOrder` con el que se leen despues.
 */
export function buildTicketLines(
  requested: readonly TicketItemInput[],
  catalog: readonly ServiceDetail[],
  products: readonly InventoryProductRecord[],
  bodyTypeId: string,
): TicketItemData[] {
  const services = buildTicketItems(requested.filter(isServiceTicketItem), catalog, bodyTypeId);
  const goods = buildProductItems(requested.filter(isProductTicketItem), products);
  let nextService = 0;
  let nextProduct = 0;

  return requested.map((item, index) => {
    const line = isProductTicketItem(item) ? goods[nextProduct++] : services[nextService++];

    return { ...line, sortOrder: index };
  });
}

/** Milesimas por unidad: la cantidad de un componente de combo es entera (104 RN-1). */
const MILLI_PER_UNIT = 1000;

/**
 * Las lineas de un combo para ese tipo de carro (104 criterio 4, RN-5, RN-6):
 * una por servicio y producto, con `comboId` y `comboName` de snapshot,
 * `catalogPrice` = precio de lista y `unitPrice` = el prorrateado. La suma de
 * `unitPrice × cantidad` es exactamente el precio del combo.
 *
 * No pasan por la regla de un servicio una vez (111) ni por la de un
 * producto una vez (065 RN-9): esas miran solo las lineas sueltas. El techo
 * del producto (`rejectPrice`) se cumple por construccion: el prorrateo nunca
 * deja un producto por encima de su lista. Igual se verifica, para que un
 * cambio en el prorrateo no lo rompa en silencio.
 */
export function buildComboLines(combo: TicketComboRecord, bodyTypeId: string): TicketItemData[] {
  return expandCombo(combo, bodyTypeId).map(({ component, catalogPrice, unitPrice }, index) => {
    const rejection =
      component.kind === 'PRODUCT'
        ? rejectPrice(unitPrice, catalogPrice)
        : rejectServicePrice(unitPrice);

    if (rejection !== null) throw new Error(`Combo ${combo.id} prorated a line out of range`);

    return {
      kind: component.kind,
      serviceId: component.serviceId,
      inventoryItemId: component.inventoryItemId,
      serviceCode: component.code,
      serviceName: component.name,
      catalogPrice,
      unitPrice,
      quantity: component.quantity * MILLI_PER_UNIT,
      taxRate: component.taxRate,
      sortOrder: index,
      comboId: combo.id,
      comboName: combo.name,
    };
  });
}

/**
 * El orden final de las lineas de un lavado (104): primero las sueltas, en el
 * orden en que llegaron, y despues cada combo con sus lineas juntas, en el
 * orden de `combos`. El `sortOrder` se renumera de corrido: la vista agrupa por
 * `comboId` y un combo queda siempre en un bloque contiguo.
 */
export function orderTicketLines(
  standalone: readonly TicketItemData[],
  comboGroups: readonly (readonly TicketItemData[])[],
): TicketItemData[] {
  return [...standalone, ...comboGroups.flat()].map((line, index) => ({
    ...line,
    sortOrder: index,
  }));
}
