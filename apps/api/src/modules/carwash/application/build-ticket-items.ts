import { API_ERROR_CODES } from '@elite/shared';
import type { ServiceDetail } from '@elite/shared';
import { UnprocessableEntityException } from '@nestjs/common';

import { catalogPriceFor, rejectPrice, type PriceableService } from '../domain/pricing';
import { toCents } from '../domain/money';
import type { TicketItemData } from './ports/ticket.repository';

/** Una linea tal como la pide el cliente del API. */
export interface RequestedItem {
  serviceId: string;
  /** Ausente = cobrar el precio de catalogo (RN-2). */
  unitPrice?: string;
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
 */
export function buildTicketItems(
  requested: readonly RequestedItem[],
  catalog: readonly ServiceDetail[],
  bodyTypeId: string,
): TicketItemData[] {
  const byId = new Map(catalog.map((service) => [service.id, service]));

  return requested.map((item, index) => {
    const service = byId.get(item.serviceId);

    if (service === undefined || !service.isActive) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Ese servicio no existe o está desactivado.',
        details: { serviceId: item.serviceId },
      });
    }

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
      serviceId: service.id,
      serviceCode: service.code,
      serviceName: service.name,
      catalogPrice,
      unitPrice,
      taxRate: service.taxRate,
      sortOrder: index,
    };
  });
}
