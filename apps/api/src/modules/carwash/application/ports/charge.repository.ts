import type { Charge, InventoryLowStockPayload, Ticket } from '@elite/shared';

import type { SaleLineSnapshot } from '../../../sales/domain/counter-sale';
import type { ChargeLine } from '../../domain/charge';
import type { Cents } from '../../domain/money';
import type { StatusActor } from './ticket.repository';

/**
 * La cuenta de cobro (059, 066).
 *
 * Todo lo que se escribe al cobrar —lavados a `PAID`, comisiones congeladas,
 * la venta suelta con su salida del kardex, filas de pago, la cuenta y su
 * numero— entra por `create` y sale por `void`, cada uno en una sola
 * transaccion (RN-7): si algo falla, no se cobra nada.
 */

/** Lo que le toca a un lavado de la cuenta, ya repartido por el dominio. */
export interface ChargeTicketData {
  workOrderId: string;
  /** El total de ese lavado. Es la base de su comision (009). */
  total: Cents;
  /** Comision congelada de **ese** lavado, no de la cuenta (009 RN-1). */
  commissionTotal: Cents;
  entries: { employeeId: string; amount: Cents }[];
  /** Un renglon por metodo de la cuenta, con la parte que le toco (RN-5). */
  payments: ChargeLine[];
}

/**
 * Los productos sueltos de la cuenta (066): se guardan como una venta suelta
 * (065) colgada de la misma cuenta, sin comision.
 */
export interface ChargeSaleData {
  customerName: string | null;
  /** Suma de las lineas. Es el peso de la venta en el reparto (RN-5). */
  total: Cents;
  lines: SaleLineSnapshot[];
  /** Un renglon por metodo de la cuenta, con la parte que le toco a la venta. */
  payments: ChargeLine[];
}

export interface NewChargeData {
  /** Suma de los lavados y la venta, igual a la suma de los pagos (RN-3). */
  total: Cents;
  cashTendered: Cents | null;
  changeGiven: Cents | null;
  /** Quien cobra: el de la sesion, nunca alguien que venga en el body. */
  userId: string;
  cashSessionId: string;
  tickets: ChargeTicketData[];
  /** `null` si la cuenta solo lleva lavados. */
  sale: ChargeSaleData | null;
}

/** La cuenta como quedo, y los avisos de minimo para publicar tras el commit. */
export interface ChargeWriteResult {
  charge: Charge;
  lowStock: InventoryLowStockPayload[];
}

/**
 * A quien se le deshace el cobro: la cuenta entera (RN-8) o —cobro anterior a
 * la 059, sin cuenta— el lavado suelto.
 */
export type VoidChargeTarget = { chargeId: string } | { workOrderId: string };

export interface VoidChargeData {
  /** Queda escrito como nota en cada lavado de la cuenta, ya firmado (045 RN-5). */
  reason: string;
  cashSessionId: string;
  /** Lo que queda escrito en la venta suelta de la cuenta, si la tiene (065 RN-22). */
  sale: {
    reason: string;
    /** Quien firmo la anulacion (045). */
    voidedByUserId: string | null;
    /** Quien la pidio desde su sesion: queda en el kardex de la devolucion. */
    userId: string | null;
  };
}

/** Lo que deshizo la anulacion de una cuenta (RN-8, 066). */
export interface VoidChargeResult {
  /** Los lavados que volvieron a `READY`, en el orden en que entraron. */
  tickets: Ticket[];
  /** La venta suelta que quedo `VOID`, o `null` si la cuenta no tenia. */
  counterSaleId: string | null;
  /** Avisos de minimo para publicar tras el commit. */
  lowStock: InventoryLowStockPayload[];
}

export interface ChargeRepository {
  /**
   * @throws los errores de existencia del kardex si la venta no alcanza (065 RN-19).
   * @throws BankAccountUnavailableError si una cuenta de transferencia ya no esta activa (069).
   */
  create(data: NewChargeData, actor: StatusActor): Promise<ChargeWriteResult>;
  findById(id: string): Promise<Charge | null>;
  void(
    target: VoidChargeTarget,
    data: VoidChargeData,
    actor: StatusActor,
  ): Promise<VoidChargeResult>;
}

/**
 * Alguno de los lavados dejo de ser cobrable entre la validacion y la
 * escritura: lo cobro otra caja primero. Lleva los ids para que el mensaje diga
 * cuales.
 */
export class TicketsNotChargeableError extends Error {
  constructor(readonly workOrderIds: string[]) {
    super('Some tickets are no longer chargeable');
    this.name = 'TicketsNotChargeableError';
  }
}

/**
 * La cuenta bancaria de una transferencia se desactivo entre la validacion y
 * la escritura (069 RN-8): no se cobra nada.
 */
export class BankAccountUnavailableError extends Error {
  constructor(readonly bankAccountIds: string[]) {
    super('Some bank accounts are no longer active');
    this.name = 'BankAccountUnavailableError';
  }
}

/** El cobro no existe ya, o no pertenece al turno de caja abierto. */
export class ChargeNotVoidableError extends Error {
  constructor() {
    super('Charge does not belong to the open cash session');
    this.name = 'ChargeNotVoidableError';
  }
}

export const CHARGE_REPOSITORY = Symbol('carwash.ChargeRepository');
