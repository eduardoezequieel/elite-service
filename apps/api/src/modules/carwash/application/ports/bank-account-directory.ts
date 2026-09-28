/**
 * Lo que el cobro necesita saber de las cuentas del negocio (069 RN-8): cuales
 * de las que trae una transferencia existen y estan activas. Nada mas: el cobro
 * no administra cuentas, y asi no importa el modulo `banking`.
 */
export interface BankAccountDirectory {
  /** Los de esos ids que existen y estan activos. Los demas no vienen. */
  findActiveIds(ids: readonly string[]): Promise<string[]>;
}

export const BANK_ACCOUNT_DIRECTORY = Symbol('carwash.BankAccountDirectory');
