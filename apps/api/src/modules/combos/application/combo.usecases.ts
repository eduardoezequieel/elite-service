import { API_ERROR_CODES, isServiceComboItem } from '@elite/shared';
import type {
  ComboDetail,
  ComboItemInput,
  ComboOption,
  ComboPriceRow,
  ComboPricingMode,
  CombosQuery,
  CreateComboInput,
  Page,
  UpdateComboInput,
} from '@elite/shared';

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/application-error';
import { toCents, toDecimalString } from '../../carwash/domain/money';
import type { BodyTypePrice } from '../../carwash/domain/pricing';
import { businessDateOf } from '../../inventory/domain/business-day';
import { toQuantityString } from '../../inventory/domain/stock';
import {
  comboPriceFor,
  listPriceFor,
  outOfStockNames,
  type ComboComponent,
} from '../domain/combo-pricing';
import { comboStatus, isAvailableOn } from '../domain/combo-status';
import type {
  ComboItemData,
  ComboRecord,
  ComboRepository,
  ComboWriteData,
  ComponentSource,
} from './ports/combo.repository';

/** Un combo pedido por un lavado, con si vale hoy (criterio 3). */
export interface ComboForTicket {
  combo: ComboRecord;
  availableToday: boolean;
}

/** Lo que el alta o la edición dejan, antes de validarlo contra la base. */
interface ComboDraft {
  name: string;
  items: ComboItemInput[] | null;
  pricingMode: ComboPricingMode;
  discountPercent: number | null;
  prices: { bodyTypeId: string; price: string }[] | null;
  validFrom: string;
  validTo: string | null;
  weekdays: number[];
  isActive: boolean;
}

/**
 * Combos del lavado (104): el catálogo (`/combos`) y lo que el alta del lavado
 * lee de ellos (`/carwash/combos`, `/floor/combos` y la expansión en líneas).
 *
 * El día de hoy lo da `today`, en la zona del taller: el estado y la
 * disponibilidad dependen de él y un test lo fija.
 */
export class ComboUseCases {
  constructor(
    private readonly combos: ComboRepository,
    private readonly today: () => string = () => businessDateOf(new Date()),
  ) {}

  /** `GET /combos`: una página con el estado calculado en la consulta. */
  async listPage(query: CombosQuery): Promise<Page<ComboDetail>> {
    const today = this.today();
    const search = query.search === undefined || query.search === '' ? undefined : query.search;
    const [page, bodyTypeIds] = await Promise.all([
      this.combos.listPage({
        search,
        status: query.status,
        today,
        page: query.page,
        pageSize: query.pageSize,
      }),
      this.combos.listActiveBodyTypeIds(),
    ]);

    return { ...page, items: page.items.map((combo) => toDetail(combo, bodyTypeIds, today)) };
  }

  async findById(id: string): Promise<ComboDetail> {
    const combo = await this.requireCombo(id);

    return toDetail(combo, await this.combos.listActiveBodyTypeIds(), this.today());
  }

  async create(input: CreateComboInput): Promise<ComboDetail> {
    const draft: ComboDraft = {
      name: input.name,
      items: input.items,
      pricingMode: input.pricingMode,
      discountPercent: input.discountPercent ?? null,
      prices: input.prices,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      weekdays: input.weekdays,
      isActive: input.isActive,
    };
    const data = await this.resolve(draft, null);

    await this.rejectTakenName(data.name, null);

    const created = await this.combos.create(data);

    return toDetail(created, await this.combos.listActiveBodyTypeIds(), this.today());
  }

  /**
   * `PATCH /combos/:id`: lo que no viene no se toca y los arrays que vienen
   * reemplazan. Las reglas se revisan sobre el combo ya combinado. Editarlo no
   * toca las líneas ya guardadas en lavados (RN-4): son snapshot.
   */
  async update(id: string, input: UpdateComboInput): Promise<ComboDetail> {
    const existing = await this.requireCombo(id);
    const pricingMode = input.pricingMode ?? existing.pricingMode;
    const discountPercent =
      input.discountPercent === undefined ? existing.discountPercent : input.discountPercent;

    if (
      pricingMode === 'FIXED' &&
      input.discountPercent !== undefined &&
      input.discountPercent !== null
    ) {
      throw invalid('discountPercent', 'Solo con descuento');
    }

    const repriced =
      input.items !== undefined || input.prices !== undefined || input.pricingMode !== undefined;
    const draft: ComboDraft = {
      name: input.name ?? existing.name,
      items: input.items ?? null,
      pricingMode,
      discountPercent: pricingMode === 'FIXED' ? null : discountPercent,
      prices:
        input.prices ??
        (repriced
          ? existing.fixedPrices.map((row) => ({
              bodyTypeId: row.bodyTypeId,
              price: toDecimalString(row.price),
            }))
          : null),
      validFrom: input.validFrom ?? existing.validFrom,
      validTo: input.validTo === undefined ? existing.validTo : input.validTo,
      weekdays: input.weekdays ?? existing.weekdays,
      isActive: input.isActive ?? existing.isActive,
    };
    const data = await this.resolve(draft, existing);

    if (data.name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.rejectTakenName(data.name, id);
    }

    const updated = await this.combos.update(id, data);

    return toDetail(updated, await this.combos.listActiveBodyTypeIds(), this.today());
  }

  /** `GET /carwash/combos` y `GET /floor/combos`: los que valen hoy (RN-3). */
  async listAvailableToday(): Promise<ComboOption[]> {
    const today = this.today();
    const [live, bodyTypeIds] = await Promise.all([
      this.combos.listLive(today),
      this.combos.listActiveBodyTypeIds(),
    ]);

    return live
      .filter((combo) => isAvailableOn(combo, today))
      .map((combo) => ({
        id: combo.id,
        name: combo.name,
        items: combo.components.map((component) => ({
          kind: component.kind,
          name: component.name,
          quantity: component.quantity,
        })),
        prices: priceRows(combo, bodyTypeIds),
        outOfStock: outOfStockNames(combo.components),
      }));
  }

  /**
   * Los combos que pide un lavado, con si valen hoy. Los ids que no existen no
   * vienen: para el lavado es lo mismo que no disponible.
   */
  async findForTickets(ids: readonly string[]): Promise<ComboForTicket[]> {
    if (ids.length === 0) return [];

    const today = this.today();
    const found = await this.combos.findByIds(ids);

    return found.map((combo) => ({ combo, availableToday: isAvailableOn(combo, today) }));
  }

  private async requireCombo(id: string): Promise<ComboRecord> {
    const combo = await this.combos.findById(id);

    if (combo === null) {
      throw new NotFoundError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Ese combo no existe.' });
    }

    return combo;
  }

  private async rejectTakenName(name: string, selfId: string | null): Promise<void> {
    const taken = await this.combos.findIdByName(name);

    if (taken !== null && taken !== selfId) {
      throw new ConflictError({
        code: API_ERROR_CODES.COMBO_NAME_TAKEN,
        message: 'Nombre repetido',
        details: { field: 'name' },
      });
    }
  }

  /**
   * Valida el borrador contra la base y lo deja listo para escribir.
   *
   * - RN-1: servicios y productos que existan, activos y vendibles. Solo se
   *   mira cuando llegan `items`: pausar o renombrar un combo cuyo servicio se
   *   desactivó después no se frena.
   * - RN-2 `FIXED`: un precio por **cada** tipo de carro activo, menor que la
   *   suma por separado. Se mira cuando cambian componentes, precios o modo.
   * - RN-3: `validTo ≥ validFrom` sobre lo ya combinado.
   */
  private async resolve(draft: ComboDraft, existing: ComboRecord | null): Promise<ComboWriteData> {
    if (draft.validTo !== null && draft.validTo < draft.validFrom) {
      throw invalid('validTo', 'Antes del inicio');
    }

    if (draft.pricingMode === 'PERCENT' && draft.discountPercent === null) {
      throw invalid('discountPercent', 'Falta el descuento');
    }

    const components =
      draft.items === null ? (existing?.components ?? []) : await this.components(draft.items);
    const items: ComboItemData[] = components.map((component) => ({
      kind: component.kind,
      serviceId: component.serviceId,
      inventoryItemId: component.inventoryItemId,
      quantity: component.quantity,
    }));

    let prices: BodyTypePrice[] = [];

    if (draft.pricingMode === 'FIXED') {
      prices =
        draft.prices === null
          ? (existing?.fixedPrices ?? [])
          : await this.fixedPrices(draft.prices, components);
    }

    return {
      name: draft.name,
      pricingMode: draft.pricingMode,
      discountPercent: draft.pricingMode === 'PERCENT' ? draft.discountPercent : null,
      validFrom: draft.validFrom,
      validTo: draft.validTo,
      weekdays: [...draft.weekdays].sort((a, b) => a - b),
      isActive: draft.isActive,
      items,
      prices,
    };
  }

  /** RN-1 contra la base: los componentes pedidos, en orden y ya cotizables. */
  private async components(items: readonly ComboItemInput[]): Promise<ComboComponent[]> {
    const serviceIds = items.filter(isServiceComboItem).map((item) => item.serviceId);
    const productIds = items.flatMap((item) =>
      isServiceComboItem(item) ? [] : [item.inventoryItemId],
    );
    const [services, products] = await Promise.all([
      serviceIds.length === 0 ? Promise.resolve([]) : this.combos.findServices(serviceIds),
      productIds.length === 0 ? Promise.resolve([]) : this.combos.findProducts(productIds),
    ]);
    const usable = (source: ComponentSource | undefined): source is ComponentSource =>
      source !== undefined && source.isActive && source.sellable;
    const serviceById = new Map(services.map((source) => [source.id, source]));
    const productById = new Map(products.map((source) => [source.id, source]));

    const badServices = serviceIds.filter((id) => !usable(serviceById.get(id)));
    const badProducts = productIds.filter((id) => !usable(productById.get(id)));

    if (badServices.length > 0 || badProducts.length > 0) {
      throw new ValidationError({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Servicio o producto inactivo',
        details: { field: 'items', serviceIds: badServices, inventoryItemIds: badProducts },
      });
    }

    return items.map((item) => {
      const source = isServiceComboItem(item)
        ? (serviceById.get(item.serviceId) as ComponentSource)
        : (productById.get(item.inventoryItemId) as ComponentSource);

      return {
        kind: source.kind,
        serviceId: source.kind === 'SERVICE' ? source.id : null,
        inventoryItemId: source.kind === 'PRODUCT' ? source.id : null,
        code: source.code,
        name: source.name,
        taxRate: source.taxRate,
        quantity: isServiceComboItem(item) ? 1 : item.quantity,
        defaultPrice: source.defaultPrice,
        prices: source.prices,
        stockOnHand: source.stockOnHand,
      };
    });
  }

  /** RN-2 `FIXED`: todos los tipos activos, ninguno de más, cada uno bajo la suma. */
  private async fixedPrices(
    rows: readonly { bodyTypeId: string; price: string }[],
    components: readonly ComboComponent[],
  ): Promise<BodyTypePrice[]> {
    const active = await this.combos.listActiveBodyTypeIds();
    const activeSet = new Set(active);
    const byBodyType = new Map(rows.map((row) => [row.bodyTypeId, toCents(row.price)]));
    const unknown = rows.filter((row) => !activeSet.has(row.bodyTypeId)).map((r) => r.bodyTypeId);
    const missing = active.filter((id) => !byBodyType.has(id));

    if (unknown.length > 0) {
      throw invalid('prices', 'Tipo de vehículo inválido', { bodyTypeIds: unknown });
    }

    if (missing.length > 0) {
      throw invalid('prices', 'Falta el precio', { bodyTypeIds: missing });
    }

    const tooHigh = active.filter(
      (id) => (byBodyType.get(id) ?? 0) >= listPriceFor(components, id),
    );

    if (tooHigh.length > 0) {
      throw invalid('prices', 'Menor que separado', {
        bodyTypeIds: tooHigh,
        listPrices: tooHigh.map((id) => ({
          bodyTypeId: id,
          listPrice: toDecimalString(listPriceFor(components, id)),
        })),
      });
    }

    return active.map((bodyTypeId) => ({ bodyTypeId, price: byBodyType.get(bodyTypeId) ?? 0 }));
  }
}

function invalid(field: string, message: string, extra: Record<string, unknown> = {}) {
  return new ValidationError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message,
    details: { field, ...extra },
  });
}

/** Un renglón por cada tipo de carro activo: suma por separado y precio del combo. */
function priceRows(combo: ComboRecord, bodyTypeIds: readonly string[]): ComboPriceRow[] {
  return bodyTypeIds.map((bodyTypeId) => ({
    bodyTypeId,
    listPrice: toDecimalString(listPriceFor(combo.components, bodyTypeId)),
    price: toDecimalString(comboPriceFor(combo, bodyTypeId)),
  }));
}

function toDetail(combo: ComboRecord, bodyTypeIds: readonly string[], today: string): ComboDetail {
  return {
    id: combo.id,
    code: combo.code,
    name: combo.name,
    pricingMode: combo.pricingMode,
    discountPercent: combo.discountPercent,
    validFrom: combo.validFrom,
    validTo: combo.validTo,
    weekdays: combo.weekdays,
    isActive: combo.isActive,
    status: comboStatus(combo, today),
    items: combo.components.map((component) => ({
      kind: component.kind,
      serviceId: component.serviceId,
      inventoryItemId: component.inventoryItemId,
      code: component.code,
      name: component.name,
      quantity: component.quantity,
      stockOnHand: component.stockOnHand === null ? null : toQuantityString(component.stockOnHand),
    })),
    prices: priceRows(combo, bodyTypeIds),
    outOfStock: outOfStockNames(combo.components),
  };
}
