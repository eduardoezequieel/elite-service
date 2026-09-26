import { API_ERROR_CODES, isProductTicketItem, isServiceTicketItem } from '@elite/shared';
import type {
  ProductTicketItemInput,
  ServiceDetail,
  ServiceTicketItemInput,
  TicketItemInput,
} from '@elite/shared';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { fromQuantityString } from '../../inventory/domain/stock';
import { ONE_UNIT, catalogPriceFor, rejectPrice, type PriceableService } from '../domain/pricing';
import { toCents, toDecimalString } from '../domain/money';
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
 * Un ticket suma rubros distintos pero nunca dos servicios del mismo rubro
 * (039 RN-1): «lavado + pulido» son dos lineas de dos categorias, y dos
 * lavados a la vez no existen. La regla se mide contra `service.category.id`,
 * jamas contra un nombre.
 */
export function buildTicketItems(
  requested: readonly RequestedItem[],
  catalog: readonly ServiceDetail[],
  bodyTypeId: string,
): TicketItemData[] {
  const byId = new Map(catalog.map((service) => [service.id, service]));
  const seenCategories = new Map<string, string>();

  return requested.map((item, index) => {
    const service = byId.get(item.serviceId);

    if (service === undefined || !service.isActive) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese servicio no existe o está desactivado.',
        details: { serviceId: item.serviceId },
      });
    }

    const taken = seenCategories.get(service.category.id);

    if (taken !== undefined) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.DUPLICATE_SERVICE_CATEGORY,
        message: `Solo un servicio de «${service.category.name}» por lavado.`,
        details: {
          categoryId: service.category.id,
          serviceIds: [taken, item.serviceId],
        },
      });
    }

    seenCategories.set(service.category.id, item.serviceId);

    const catalogPrice = catalogPriceFor(toPriceable(service), bodyTypeId);
    const unitPrice = item.unitPrice === undefined ? catalogPrice : toCents(item.unitPrice);
    const rejection = rejectPrice(unitPrice, catalogPrice);

    if (rejection === 'ABOVE_CATALOG') {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.PRICE_ABOVE_CATALOG,
        message: 'El precio no puede ser mayor al del catálogo. El descuento solo baja.',
        details: { serviceId: item.serviceId, catalogPrice: service.defaultPrice },
      });
    }

    if (rejection === 'NEGATIVE') {
      throw new UnprocessableEntityException({
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
    };
  });
}

/**
 * Las lineas de producto (065 RN-6, RN-7, RN-9), con el mismo snapshot que un
 * servicio mas la cantidad: codigo, nombre, `catalogPrice` (el precio del
 * articulo hoy), `unitPrice` e IVA. Un producto tiene un solo precio, sin
 * matriz por tipo de carro.
 *
 * La regla de un servicio por categoria (039) no aplica: un lavado lleva los
 * productos que quiera, pero cada uno **una vez**, con su cantidad (RN-9).
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
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese producto no existe.',
        details: { inventoryItemId: item.inventoryItemId },
      });
    }

    if (product.kind !== 'PRODUCT') {
      throw new ConflictException({
        code: API_ERROR_CODES.ITEM_NOT_SELLABLE,
        message: `«${product.name}» es un insumo: no se vende.`,
        details: { itemId: product.id },
      });
    }

    if (seen.has(product.id)) {
      throw new UnprocessableEntityException({
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
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.PRICE_ABOVE_CATALOG,
        message: 'El precio no puede ser mayor al del producto. El descuento solo baja.',
        details: { inventoryItemId: product.id, catalogPrice: toDecimalString(catalogPrice) },
      });
    }

    if (rejection === 'NEGATIVE') {
      throw new UnprocessableEntityException({
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
