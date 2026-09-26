import { API_ERROR_CODES } from '@elite/shared';
import type {
  CarwashEventActor,
  CounterSale,
  CounterSalesQuery,
  CreateCounterSaleInput,
  Page,
  VoidCounterSaleInput,
} from '@elite/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';

import type { ActionAuthorizer } from '../../../common/auth/authenticated-user';
import { civilDateInBusinessZone } from '../../carwash/domain/commission';
import type { AccountCharger } from './ports/account-charger';
import type { CounterSaleRepository } from './ports/counter-sale.repository';

/**
 * La venta suelta (065 RN-18 a RN-22, 066).
 *
 * Nace cobrada y es una cuenta de la 059 sin lavados: vender delega en la
 * cuenta —la misma que cobra lavados, con las mismas reglas de pago, precio,
 * existencia y turno— y anular deshace esa cuenta entera, con los lavados que
 * se hayan cobrado junto a la venta. Asi no hay un segundo camino que escriba
 * pagos ni kardex. No genera comision.
 */
export class CounterSaleUseCases {
  constructor(
    private readonly sales: CounterSaleRepository,
    private readonly accounts: AccountCharger,
  ) {}

  async list(query: CounterSalesQuery): Promise<Page<CounterSale>> {
    return this.sales.list({
      date: query.date ?? civilDateInBusinessZone(),
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  async findById(id: string): Promise<CounterSale> {
    const sale = await this.sales.findById(id);

    if (sale === null) throw saleNotFound();

    return sale;
  }

  /** Vende y cobra en el mismo acto: una cuenta sin lavados (RN-18 a RN-21, 066). */
  async create(
    input: CreateCounterSaleInput,
    userId: string,
    actor: CarwashEventActor | null = null,
  ): Promise<CounterSale> {
    const charge = await this.accounts.create(
      {
        workOrderIds: [],
        products: input.items,
        customerName: input.customerName,
        payments: input.payments,
        cashTendered: input.cashTendered,
        priceAuthorization: input.priceAuthorization,
      },
      userId,
      actor,
    );

    if (charge.counterSale === null) {
      throw new Error(`Charge ${charge.id} was created without its counter sale`);
    }

    return this.findById(charge.counterSale.id);
  }

  /**
   * Anula la venta (RN-22), que es deshacer su cuenta entera (066): pagos y
   * cuenta salen del turno, la venta queda `VOID` firmada con sus productos de
   * vuelta al inventario, y los lavados cobrados con ella vuelven a `READY`.
   * Solo si es del turno abierto: la caja de ayer ya cuadro.
   */
  async voidById(
    id: string,
    input: VoidCounterSaleInput,
    authorizer: ActionAuthorizer | null,
    actor: CarwashEventActor | null = null,
  ): Promise<CounterSale> {
    const current = await this.findById(id);

    if (current.status === 'VOID') throw alreadyVoid();
    if (current.charge === null || !current.isVoidable) throw sessionGone();

    try {
      await this.accounts.voidAccount(
        current.charge.id,
        { reason: input.reason, authorizer },
        actor,
      );
    } catch (error) {
      // La cuenta ya no existe: otra caja la deshizo primero.
      if (error instanceof NotFoundException) throw alreadyVoid();

      throw error;
    }

    return this.findById(id);
  }
}

function saleNotFound(): NotFoundException {
  return new NotFoundException({
    code: API_ERROR_CODES.NOT_FOUND,
    message: 'Esa venta no existe.',
  });
}

function alreadyVoid(): ConflictException {
  return new ConflictException({
    code: API_ERROR_CODES.SALE_ALREADY_VOID,
    message: 'Esa venta ya estaba anulada.',
  });
}

function sessionGone(): ConflictException {
  return new ConflictException({
    code: API_ERROR_CODES.CASH_SESSION_GONE,
    message: 'Esa venta no es de la caja abierta. No se puede anular.',
  });
}
