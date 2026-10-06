'use client';

import { PERMISSIONS, moneyToCents } from '@elite/shared';
import type { RentalAgreement, RentalPayment } from '@elite/shared';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { VoidPaymentDialog } from '@/features/rental-billing/components/void-payment-dialog';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS, accountLines, guaranteeLine } from '../agreement-format';
import { AmountRow } from './rental-fields';

/** La cuenta de una renta (108): tres cifras, renglones, pagos y la garantía. */
export function AgreementAccount({ agreement }: { agreement: RentalAgreement }) {
  const { can } = usePermissions();
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const [voiding, setVoiding] = useState<RentalPayment | null>(null);
  const { totals } = agreement;
  const owes = moneyToCents(totals.balance) > 0;

  return (
    <Card className="gap-4 px-card">
      <CardSectionHeading>Cuenta</CardSectionHeading>
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Total" value={formatMoneyCompact(totals.total)} />
        <Figure label="Pagado" value={formatMoneyCompact(totals.paid)} />
        <Figure label="Debe" value={formatMoneyCompact(totals.balance)} danger={owes} />
      </div>
      <div className="flex flex-col gap-1.5">
        {accountLines(agreement).map((line) => (
          <AmountRow
            key={line.key}
            label={line.label}
            value={`${line.minus ? '−' : ''}${formatMoneyCompact(line.amount)}`}
          />
        ))}
      </div>
      <p className="text-body font-semibold">{guaranteeLine(agreement)}</p>
      {agreement.payments.length === 0 ? null : (
        <ul className="border-line-soft flex flex-col gap-1 border-t pt-3">
          {agreement.payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  'text-dense',
                  payment.voidedAt === null ? undefined : 'is-ruled-out',
                )}
              >
                {formatMoneyCompact(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method]}
                {payment.voidedAt === null ? null : <span className="sr-only"> anulado</span>}
              </span>
              {payment.voidedAt !== null || !canCharge ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="Más">
                      <MoreHorizontal className="size-icon" strokeWidth={1.5} aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setVoiding(payment)}>Anular</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
      {voiding === null ? null : (
        <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} />
      )}
    </Card>
  );
}

function Figure({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className="text-text-dim text-label">{label}</span>
      <span className={cn('text-title tabular-nums', danger && 'text-danger-text')}>{value}</span>
    </p>
  );
}
