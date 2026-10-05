import type { ComboOption } from '@elite/shared';

import type { ComboPricing } from '../../../combos/domain/combo-pricing';

/**
 * Un combo tal como lo necesita el lavado para expandirlo en líneas (104):
 * componentes con su precio de lista por tipo de carro, cómo se cotiza y si
 * vale hoy.
 */
export interface TicketComboRecord extends ComboPricing {
  id: string;
  name: string;
  /** `LIVE` y el día de la semana de hoy está en sus días (RN-3). */
  availableToday: boolean;
}

/**
 * Lo que el lavado lee de los combos (104). El catálogo de combos es de su
 * módulo; el lavado solo lista los de hoy y los expande al guardar.
 */
export interface ComboCatalog {
  /** Los que valen hoy, para la tarjeta del alta (oficina y pista). */
  listAvailable(): Promise<ComboOption[]>;
  /** Los que existan de esos ids, en cualquier estado. Los que no existen no vienen. */
  findByIds(ids: readonly string[]): Promise<TicketComboRecord[]>;
}

export const COMBO_CATALOG = Symbol('carwash.ComboCatalog');
