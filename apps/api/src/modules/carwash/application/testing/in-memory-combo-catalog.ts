import type { ComboOption } from '@elite/shared';

import { toDecimalString } from '../../domain/money';
import { comboPriceFor, listPriceFor, outOfStockNames } from '../../../combos/domain/combo-pricing';
import type { ComboCatalog, TicketComboRecord } from '../ports/combo-catalog';

/**
 * Combos en memoria para los tests del lavado (104). `availableToday` lo fija
 * el test: la vigencia se prueba en el dominio de combos.
 */
export class InMemoryComboCatalog implements ComboCatalog {
  readonly combos = new Map<string, TicketComboRecord>();

  constructor(private readonly bodyTypeIds: readonly string[] = []) {}

  add(combo: TicketComboRecord): TicketComboRecord {
    this.combos.set(combo.id, combo);

    return combo;
  }

  /** Cambia el combo en el catálogo (precio, pausa, vigencia) sin tocar los lavados. */
  change(id: string, changes: Partial<TicketComboRecord>): void {
    const combo = this.combos.get(id);

    if (combo === undefined) throw new Error(`Unknown combo ${id}`);

    this.combos.set(id, { ...combo, ...changes });
  }

  async listAvailable(): Promise<ComboOption[]> {
    return [...this.combos.values()]
      .filter((combo) => combo.availableToday)
      .map((combo) => ({
        id: combo.id,
        name: combo.name,
        items: combo.components.map((component) => ({
          kind: component.kind,
          name: component.name,
          quantity: component.quantity,
        })),
        prices: this.bodyTypeIds.map((bodyTypeId) => ({
          bodyTypeId,
          listPrice: toDecimalString(listPriceFor(combo.components, bodyTypeId)),
          price: toDecimalString(comboPriceFor(combo, bodyTypeId)),
        })),
        outOfStock: outOfStockNames(combo.components),
      }));
  }

  async findByIds(ids: readonly string[]): Promise<TicketComboRecord[]> {
    return ids.flatMap((id) => this.combos.get(id) ?? []);
  }
}
