import type { CashSessionPayment, CashSessionTransferLine, PaymentMethod } from '@elite/shared';
import { ArrowLeftRight, Banknote, CreditCard, Wallet, type LucideIcon } from 'lucide-react';

import { Card, CardSectionHeading } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { formatMoney, moneyParts } from '@/lib/money';
import { METHOD_LABELS, otherPaymentLines } from '../cash-format';

/**
 * El arqueo por método: efectivo, tarjeta, transferencia y «Otro» (069), uno
 * al lado del otro.
 *
 * Es el motivo de la pantalla de caja, así que se dibuja con la tarjeta de
 * estadística y no con filas de texto perdidas entre los demás montos (055).
 * Efectivo va en verde porque es lo único que está en el cajón; los otros se
 * informan.
 *
 * Los cuatro aparecen siempre, aunque den `$0.00`: un arqueo al que le falta un
 * método no es un arqueo. Debajo, lo que hace falta para cuadrar contra el
 * banco (069 RN-7): cuánto entró en cada cuenta —las transferencias viejas, sin
 * cuenta, en su fila «Sin cuenta»— y qué fue cada «Otro».
 */
const ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  OTHER: Wallet,
};

const ORDER: readonly PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

export interface CashMethodTotals {
  cashTotal: string | null;
  cardTotal: string | null;
  transferTotal: string | null;
  otherTotal: string | null;
  transferByAccount: readonly CashSessionTransferLine[];
}

function amountOf(totals: CashMethodTotals, method: PaymentMethod): string {
  if (method === 'CASH') return totals.cashTotal ?? '0.00';
  if (method === 'CARD') return totals.cardTotal ?? '0.00';
  if (method === 'OTHER') return totals.otherTotal ?? '0.00';

  return totals.transferTotal ?? '0.00';
}

export function CashMethodStats({
  totals,
  payments,
}: {
  totals: CashMethodTotals;
  /** Los cobros del turno, de donde sale la lista de «Otro». Sin ellos, no se dibuja. */
  payments?: readonly CashSessionPayment[];
}) {
  const transfers = totals.transferByAccount;
  const others = otherPaymentLines(payments ?? []);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((method) => {
          const Icon = ICONS[method];
          const amount = moneyParts(amountOf(totals, method));

          return (
            <StatCard
              key={method}
              label={METHOD_LABELS[method]}
              value={amount.whole}
              unit={amount.fraction}
              tone={method === 'CASH' ? 'go' : 'default'}
              icon={<Icon strokeWidth={1.5} />}
            />
          );
        })}
      </div>

      {transfers.length === 0 && others.length === 0 ? null : (
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
          {transfers.length === 0 ? null : (
            <Card className="gap-2.5 px-card">
              <CardSectionHeading aside={formatMoney(totals.transferTotal ?? '0.00')}>
                Transferencias por cuenta
              </CardSectionHeading>
              {transfers.map((line) => (
                <BreakdownRow
                  key={line.bankAccountId ?? 'none'}
                  label={line.label}
                  amount={line.total}
                />
              ))}
            </Card>
          )}

          {others.length === 0 ? null : (
            <Card className="gap-2.5 px-card">
              <CardSectionHeading aside={formatMoney(totals.otherTotal ?? '0.00')}>
                Otro
              </CardSectionHeading>
              {others.map((line) => (
                <BreakdownRow key={line.id} label={line.description} amount={line.amount} />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/** Una fila del desglose: qué a la izquierda, cuánto a la derecha. */
function BreakdownRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text text-body min-w-0 break-words">{label}</span>
      <span className="text-text shrink-0 font-mono tabular-nums">{formatMoney(amount)}</span>
    </div>
  );
}
