import type { ComboPricingMode, ComboStatus, Page, PageQuery, TicketItemKind } from '@elite/shared';

import type { Cents } from '../../../carwash/domain/money';
import type { BodyTypePrice } from '../../../carwash/domain/pricing';
import type { Milli } from '../../../inventory/domain/stock';
import type { ComboComponent, ComboPricing } from '../../domain/combo-pricing';
import type { ComboWindow } from '../../domain/combo-status';

/**
 * Un combo tal como lo guarda la base, con sus componentes ya cotizables
 * (matriz del servicio, precio y existencia del producto de hoy).
 */
export interface ComboRecord extends ComboPricing, ComboWindow {
  id: string;
  /** `CMB-0001`. */
  code: string;
  name: string;
  /** Ordenados de 0 a 6. */
  weekdays: number[];
  components: ComboComponent[];
  /** Vacío en `PERCENT`. */
  fixedPrices: BodyTypePrice[];
}

/**
 * Un servicio o producto que se quiere poner en un combo, con lo que hace falta
 * para validarlo (RN-1) y cotizarlo (RN-2).
 */
export interface ComponentSource {
  kind: TicketItemKind;
  id: string;
  code: string;
  name: string;
  taxRate: string;
  isActive: boolean;
  /** `false` en un insumo: no se vende (065). Siempre `true` en un servicio. */
  sellable: boolean;
  /** Servicio: precio base; producto: precio de venta. */
  defaultPrice: Cents;
  /** Matriz del servicio. Vacía en un producto. */
  prices: BodyTypePrice[];
  /** `null` en un servicio. */
  stockOnHand: Milli | null;
}

/** Un componente a guardar, en el orden en que llegó. */
export interface ComboItemData {
  kind: TicketItemKind;
  serviceId: string | null;
  inventoryItemId: string | null;
  /** Entera. */
  quantity: number;
}

/** El combo completo a escribir: el alta y la edición mandan todo (los arrays reemplazan). */
export interface ComboWriteData {
  name: string;
  pricingMode: ComboPricingMode;
  discountPercent: number | null;
  validFrom: string;
  validTo: string | null;
  weekdays: number[];
  isActive: boolean;
  items: ComboItemData[];
  /** Solo en `FIXED`. */
  prices: BodyTypePrice[];
}

/** `GET /combos`: el estado se calcula en la consulta con el día de hoy (RN-3). */
export interface ComboPageFilter extends PageQuery {
  search?: string;
  status?: ComboStatus;
  /** Día civil de hoy, `YYYY-MM-DD`. */
  today: string;
}

export interface ComboRepository {
  /** Una página, orden `name`, `id` (102). */
  listPage(filter: ComboPageFilter): Promise<Page<ComboRecord>>;
  findById(id: string): Promise<ComboRecord | null>;
  /** Los que existan de esos ids, en cualquier estado. */
  findByIds(ids: readonly string[]): Promise<ComboRecord[]>;
  /**
   * Activos con `today` entre `validFrom` y `validTo`, orden `name`, `id`. El
   * día de la semana lo filtra el dominio (`isAvailableOn`).
   */
  listLive(today: string): Promise<ComboRecord[]>;
  /** Id del combo con ese nombre sin distinguir mayúsculas, o `null` (RN-4). */
  findIdByName(name: string): Promise<string | null>;
  /** Servicios del lavado de esos ids, activos o no. Los que no existen no vienen. */
  findServices(ids: readonly string[]): Promise<ComponentSource[]>;
  /** Artículos del inventario de esos ids, activos o no. */
  findProducts(ids: readonly string[]): Promise<ComponentSource[]>;
  /** Tipos de carro activos, por `sortOrder`. */
  listActiveBodyTypeIds(): Promise<string[]>;
  /** Saca el correlativo `CMB-NNNN` y guarda (073). */
  create(data: ComboWriteData): Promise<ComboRecord>;
  update(id: string, data: ComboWriteData): Promise<ComboRecord>;
}

export const COMBO_REPOSITORY = Symbol('combos.ComboRepository');
