import type { TabHolder, TabHolderRef } from '@elite/shared';

/**
 * Lo que las cuentas necesitan leer de otros módulos antes de escribir: el
 * titular, el turno de caja y las cuentas bancarias. Lecturas, nada más; el
 * repositorio vuelve a mirar turno y cuenta bancaria dentro de la transacción.
 */
export interface TabLookups {
  /** El empleado activo o el cliente. `null` si no existe o el empleado está inactivo. */
  findHolder(ref: TabHolderRef): Promise<TabHolder | null>;
  /** El turno de caja abierto (038). `null` si no hay. */
  findOpenCashSessionId(): Promise<string | null>;
  /** De esos ids, los que existen y están activos (069 RN-8). */
  findActiveBankAccountIds(ids: readonly string[]): Promise<string[]>;
}

export const TAB_LOOKUPS = Symbol('tabs.TabLookups');
