import { RENTAL_PAYMENT_METHOD_ORDER, centsToMoney, moneyToCents } from '@elite/shared';
import type {
  CashQuery,
  DepositHeldRow,
  DepositsHeldList,
  PageQuery,
  PaymentMethod,
  ReceivableRow,
  ReceivablesList,
  RentalCashPayment,
  RentalCashReport,
} from '@elite/shared';

import { slicePage } from '../../../common/pagination/page';
import { businessDateOf, businessDayBounds } from '../../inventory/domain/business-day';
import { isReceivable } from '../domain/billing-rules';
import { heldDepositOf, paymentUserIds, toRentalPayment, totalsOf } from './billing-view';
import type { AgreementReader, BillingAgreementRecord } from './ports/agreement-reader';
import type { CashPaymentRecord, RentalPaymentRepository } from './ports/rental-payment.repository';
import type { UserDirectory } from './ports/user-directory';

/**
 * La «Caja» de la rentadora (098): un reporte del día, no un turno. Nada de
 * apertura ni arqueo, y nada compartido con la caja del lavado. Tampoco hay
 * foto guardada (RN-5): se calcula cada vez.
 */
export class RentalCashUseCases {
  constructor(
    private readonly agreements: AgreementReader,
    private readonly payments: RentalPaymentRepository,
    private readonly users: UserDirectory,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async report(query: CashQuery): Promise<RentalCashReport> {
    const date = query.date ?? businessDateOf(this.clock());
    const { start, end } = businessDayBounds(date);
    const rows = await this.payments.listPaidBetween(start, end);
    const live = rows.filter((row) => row.voidedAt === null);
    // Las sumas son del día entero; solo la lista de pagos vigentes se pagina (101).
    const page = slicePage(live, query);
    const voided = rows.filter((row) => row.voidedAt !== null);
    const names = await this.users.namesOf(paymentUserIds([...live, ...voided]));
    const present = (row: CashPaymentRecord): RentalCashPayment => ({
      ...toRentalPayment(row, names),
      contractNumber: row.contractNumber,
      customerName: row.customerName,
    });
    const byMethod = Object.fromEntries(
      RENTAL_PAYMENT_METHOD_ORDER.map((method) => [method, 0]),
    ) as Record<PaymentMethod, number>;
    const byUser = new Map<string, number>();
    let total = 0;

    for (const row of live) {
      const cents = moneyToCents(row.amount);

      total += cents;
      byMethod[row.method] += cents;
      byUser.set(row.receivedByUserId, (byUser.get(row.receivedByUserId) ?? 0) + cents);
    }

    return {
      date,
      total: centsToMoney(total),
      byMethod: Object.fromEntries(
        RENTAL_PAYMENT_METHOD_ORDER.map((method) => [method, centsToMoney(byMethod[method])]),
      ) as Record<PaymentMethod, string>,
      byUser: [...byUser.entries()]
        .sort(([, left], [, right]) => right - left)
        .map(([userId, cents]) => ({
          userId,
          name: names.get(userId) ?? 'Usuario eliminado',
          total: centsToMoney(cents),
        })),
      payments: { ...page, items: page.items.map(present) },
      voided: voided.map(present),
    };
  }

  /** RN-2 de a una página (101); `totalAmount` es de todas las filas. */
  async depositsHeld(query: PageQuery): Promise<DepositsHeldList> {
    const rows = depositsHeld(await this.agreements.listOpenAccounts());

    return { ...slicePage(rows, query), totalAmount: sumOf(rows, (row) => row.amount) };
  }

  /** RN-3 de a una página (101); `totalBalance` es de todas las filas. */
  async receivables(query: PageQuery): Promise<ReceivablesList> {
    const rows = receivables(await this.agreements.listOpenAccounts());

    return { ...slicePage(rows, query), totalBalance: sumOf(rows, (row) => row.balance) };
  }
}

function sumOf<T>(rows: readonly T[], amount: (row: T) => string): string {
  return centsToMoney(rows.reduce((sum, row) => sum + moneyToCents(amount(row)), 0));
}

/** RN-2, por número de contrato y después por `id`. */
function depositsHeld(accounts: readonly BillingAgreementRecord[]): DepositHeldRow[] {
  return accounts
    .map((agreement) => ({ agreement, held: heldDepositOf(agreement) }))
    .filter(({ held }) => held > 0)
    .sort((left, right) => byContract(left.agreement, right.agreement))
    .map(({ agreement, held }) => ({
      agreementId: agreement.id,
      contractNumber: agreement.contractNumber,
      customer: agreement.customerName,
      amount: centsToMoney(held),
    }));
}

/** RN-3, de la que más debe a la que menos. */
function receivables(accounts: readonly BillingAgreementRecord[]): ReceivableRow[] {
  const rows: (ReceivableRow & { cents: number })[] = [];

  for (const agreement of accounts) {
    if (agreement.status !== 'IN_PROGRESS' && agreement.status !== 'FINISHED') continue;

    const totals = totalsOf(agreement);
    const cents = moneyToCents(totals.balance);

    if (!isReceivable(agreement.status, cents)) continue;

    rows.push({
      agreementId: agreement.id,
      contractNumber: agreement.contractNumber,
      customer: agreement.customerName,
      total: totals.total,
      paid: totals.paid,
      balance: totals.balance,
      status: agreement.status,
      cents,
    });
  }

  return rows
    .sort(
      (left, right) =>
        right.cents - left.cents || left.agreementId.localeCompare(right.agreementId),
    )
    .map(({ cents: _cents, ...row }) => row);
}

function byContract(left: BillingAgreementRecord, right: BillingAgreementRecord): number {
  return (
    (left.contractNumber ?? Number.MAX_SAFE_INTEGER) -
      (right.contractNumber ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id)
  );
}
