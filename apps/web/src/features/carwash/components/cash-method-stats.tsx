import type { PaymentMethod } from '@elite/shared';
import { ArrowLeftRight, Banknote, CreditCard, type LucideIcon } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';
import { METHOD_LABELS, moneyParts } from '../cash-format';

/**
 * El arqueo por método: efectivo, tarjeta y transferencia, uno al lado del otro.
 *
 * Es el motivo de la pantalla de caja, así que se dibuja con la tarjeta de
 * estadística y no con tres filas de texto perdidas entre los demás montos
 * (055). Efectivo va en verde porque es lo único que está en el cajón; los
 * otros dos se informan.
 *
 * Los tres aparecen siempre, aunque den `$0.00`: un arqueo al que le falta un
 * método no es un arqueo.
 */
const ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
};

const ORDER: readonly PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER'];

export interface CashMethodTotals {
  cashTotal: string | null;
  cardTotal: string | null;
  transferTotal: string | null;
}

function amountOf(totals: CashMethodTotals, method: PaymentMethod): string {
  if (method === 'CASH') return totals.cashTotal ?? '0.00';
  if (method === 'CARD') return totals.cardTotal ?? '0.00';

  return totals.transferTotal ?? '0.00';
}

export function CashMethodStats({ totals }: { totals: CashMethodTotals }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
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
  );
}
