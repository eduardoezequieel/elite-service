import type { Page } from '@elite/shared';

import { slicePage } from '../../../../common/pagination/page';
import { comboStatus } from '../../domain/combo-status';
import type {
  ComboPageFilter,
  ComboRecord,
  ComboRepository,
  ComboWriteData,
  ComponentSource,
} from '../ports/combo.repository';

/**
 * Combos en memoria, con las mismas reglas que el repositorio de Prisma:
 * correlativo `CMB-NNNN`, nombre sin distinguir mayúsculas, orden `name`, `id`
 * y el estado calculado con el día que pide el filtro.
 */
export class InMemoryComboRepository implements ComboRepository {
  readonly rows = new Map<string, ComboRecord>();
  readonly services = new Map<string, ComponentSource>();
  readonly products = new Map<string, ComponentSource>();
  bodyTypeIds: string[] = [];
  private sequence = 0;

  addService(source: Partial<ComponentSource> & { id: string }): ComponentSource {
    const stored: ComponentSource = {
      kind: 'SERVICE',
      code: `SRV-${source.id}`,
      name: `Servicio ${source.id}`,
      taxRate: '0.1300',
      isActive: true,
      sellable: true,
      defaultPrice: 1000,
      prices: [],
      stockOnHand: null,
      ...source,
    };

    this.services.set(stored.id, stored);

    return stored;
  }

  addProduct(source: Partial<ComponentSource> & { id: string }): ComponentSource {
    const stored: ComponentSource = {
      kind: 'PRODUCT',
      code: `INV-${source.id}`,
      name: `Producto ${source.id}`,
      taxRate: '0.1300',
      isActive: true,
      sellable: true,
      defaultPrice: 300,
      prices: [],
      stockOnHand: 10_000,
      ...source,
    };

    this.products.set(stored.id, stored);

    return stored;
  }

  async listPage(filter: ComboPageFilter): Promise<Page<ComboRecord>> {
    const term = filter.search?.toLowerCase();
    const rows = this.sorted().filter(
      (combo) =>
        (term === undefined ||
          combo.name.toLowerCase().includes(term) ||
          combo.code.toLowerCase().includes(term)) &&
        (filter.status === undefined || comboStatus(combo, filter.today) === filter.status),
    );

    return slicePage(rows, filter);
  }

  async findById(id: string): Promise<ComboRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<ComboRecord[]> {
    return ids.flatMap((id) => {
      const combo = this.rows.get(id);

      return combo === undefined ? [] : [combo];
    });
  }

  async listLive(today: string): Promise<ComboRecord[]> {
    return this.sorted().filter((combo) => comboStatus(combo, today) === 'LIVE');
  }

  async findIdByName(name: string): Promise<string | null> {
    const lower = name.toLowerCase();

    return [...this.rows.values()].find((combo) => combo.name.toLowerCase() === lower)?.id ?? null;
  }

  async findServices(ids: readonly string[]): Promise<ComponentSource[]> {
    return ids.flatMap((id) => this.services.get(id) ?? []);
  }

  async findProducts(ids: readonly string[]): Promise<ComponentSource[]> {
    return ids.flatMap((id) => this.products.get(id) ?? []);
  }

  async listActiveBodyTypeIds(): Promise<string[]> {
    return [...this.bodyTypeIds];
  }

  async create(data: ComboWriteData): Promise<ComboRecord> {
    this.sequence += 1;

    const id = `combo-${this.sequence}`;
    const record = this.toRecord(id, `CMB-${String(this.sequence).padStart(4, '0')}`, data);

    this.rows.set(id, record);

    return record;
  }

  async update(id: string, data: ComboWriteData): Promise<ComboRecord> {
    const existing = this.rows.get(id);

    if (existing === undefined) throw new Error(`Unknown combo ${id}`);

    const record = this.toRecord(id, existing.code, data);

    this.rows.set(id, record);

    return record;
  }

  private sorted(): ComboRecord[] {
    return [...this.rows.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }

  private toRecord(id: string, code: string, data: ComboWriteData): ComboRecord {
    return {
      id,
      code,
      name: data.name,
      pricingMode: data.pricingMode,
      discountPercent: data.discountPercent,
      validFrom: data.validFrom,
      validTo: data.validTo,
      weekdays: [...data.weekdays],
      isActive: data.isActive,
      fixedPrices: [...data.prices],
      components: data.items.map((item) => {
        const source =
          item.kind === 'SERVICE'
            ? this.services.get(item.serviceId ?? '')
            : this.products.get(item.inventoryItemId ?? '');

        if (source === undefined) throw new Error('Unknown combo component');

        return {
          kind: item.kind,
          serviceId: item.serviceId,
          inventoryItemId: item.inventoryItemId,
          code: source.code,
          name: source.name,
          taxRate: source.taxRate,
          quantity: item.quantity,
          defaultPrice: source.defaultPrice,
          prices: source.prices,
          stockOnHand: source.stockOnHand,
        };
      }),
    };
  }
}
