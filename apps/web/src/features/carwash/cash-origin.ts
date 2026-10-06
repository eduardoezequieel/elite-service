import type { CashSessionPayment } from '@elite/shared';

/**
 * De qué es un cobro del turno de lavado y a dónde lleva su fila: un lavado,
 * una venta suelta (065) o el abono a una cuenta abierta (106). `label` nombra
 * la cuenta en el detalle: su número solo no diría que es un abono.
 */
export function cashPaymentOrigin(
  payment: Pick<
    CashSessionPayment,
    'workOrderId' | 'ticketNumber' | 'counterSaleId' | 'saleNumber' | 'tabId' | 'tabNumber'
  >,
): { number: string; href: string; label: string | null } {
  if (payment.tabId !== null) {
    const number = payment.tabNumber ?? '';

    return { number, href: `/sales/tabs/${payment.tabId}`, label: `Cuenta ${number}` };
  }

  if (payment.counterSaleId !== null) {
    const number = payment.saleNumber ?? '';

    return { number, href: `/sales/${payment.counterSaleId}`, label: null };
  }

  return {
    number: payment.ticketNumber ?? '',
    href: `/carwash/${payment.workOrderId ?? ''}`,
    label: null,
  };
}
