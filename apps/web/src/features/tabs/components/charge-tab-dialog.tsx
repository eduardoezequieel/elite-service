'use client';

import type { PaymentMethod, TabDetail } from '@elite/shared';
import { useState } from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { FilterChip } from '@/components/ui/filter-chip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveBankAccounts } from '@/features/banking/hooks/use-bank-accounts';
import { MethodPicker, PaymentDetailsFields } from '@/features/carwash/components/charge-payment';
import {
  chargeErrorMessage,
  paymentDetailsBlocker,
  transferUnavailableReason,
  withEffectiveAccount,
  type PaymentDetailsDraft,
} from '@/features/carwash/payment-details';
import { maskMoneyInput } from '@/features/carwash/pricing';
import { centsToAmount, formatCents, parseCents, toCents } from '@/lib/money';
import { usePayTab } from '../hooks/use-tabs';
import {
  cashChangeCents,
  chargeAmountBlocker,
  chargeQuickAmounts,
  chargeVerb,
  payTabInput,
  remainingAfter,
} from '../tab-format';

/**
 * «Cobrar» una cuenta (106): un abono o el saldo entero, con un método.
 *
 * El monto arranca en lo que debe, con los atajos «Todo», «$5.00» y «$10.00».
 * Los métodos y sus datos son los de cualquier cobro (069). En efectivo,
 * «Recibido» y «Vuelto» se calculan en pantalla y no se guardan. Si es una
 * parte, dice cuánto queda debiendo y el botón dice «Abonar»; si es todo,
 * «Cobrar $X y cerrar». Entra al turno de caja abierto.
 *
 * Recibe la cuenta de la consulta en cada render (051), nunca una copia. Se
 * monta al abrir, así que cada apertura arranca en el saldo de ese momento.
 */
export function ChargeTabDialog({
  tab,
  onOpenChange,
}: {
  tab: TabDetail;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const pay = usePayTab(tab.id);
  const balanceCents = toCents(tab.balance) ?? 0;
  const [amount, setAmount] = useState(() => centsToAmount(balanceCents));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [details, setDetails] = useState<PaymentDetailsDraft>({});
  const [received, setReceived] = useState('');
  const bankAccounts = useActiveBankAccounts();
  const accounts = bankAccounts.data ?? [];
  const accountIds = accounts.map((account) => account.id);
  const transferOff = transferUnavailableReason({
    isPending: bankAccounts.isPending,
    isError: bankAccounts.isError,
    count: accounts.length,
  });
  const singleDetails = withEffectiveAccount({ ...details, method }, accountIds);

  const amountCents = parseCents(amount);
  const amountBlocker = chargeAmountBlocker(amountCents, balanceCents);
  const blocker = amountBlocker ?? paymentDetailsBlocker(method, singleDetails, accountIds);
  const remaining = remainingAfter(balanceCents, amountCents);
  const change = cashChangeCents(received, amountCents);

  function submit(): void {
    if (blocker !== null || pay.isPending) return;

    pay.mutate(payTabInput({ method, amountCents, details: singleDetails }), {
      onSuccess: (next) => {
        toast({
          title: next.status === 'CLOSED' ? 'Pagada' : `Abono de ${formatCents(amountCents)}`,
        });
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-lg [[data-density=bahia]_&]:md:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cobrar a {tab.holder.fullName}</DialogTitle>
          <DialogDescription>
            Debe <b className="text-text font-mono font-semibold tabular-nums">${tab.balance}</b>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldBox>
            <Label htmlFor="tab-charge-amount">Monto</Label>
            <Input
              id="tab-charge-amount"
              inputMode="decimal"
              autoComplete="off"
              className="font-mono text-title tabular-nums"
              value={amount}
              aria-invalid={amountBlocker !== null && amount.trim() !== ''}
              onChange={(event) => setAmount(maskMoneyInput(event.target.value))}
            />
          </FieldBox>

          <div role="group" aria-label="Atajos del monto" className="flex flex-wrap gap-2">
            {chargeQuickAmounts(balanceCents).map((quick) => (
              <FilterChip
                key={quick.label}
                pressed={amountCents === quick.cents}
                onClick={() => setAmount(centsToAmount(quick.cents))}
              >
                {quick.label}
              </FilterChip>
            ))}
          </div>

          <MethodPicker
            value={method}
            onValueChange={setMethod}
            disabled={transferOff === null ? {} : { TRANSFER: transferOff }}
          />
          <PaymentDetailsFields
            idPrefix="tab-charge"
            method={method}
            details={singleDetails}
            accounts={accounts}
            onChange={setDetails}
          />

          {method === 'CASH' ? (
            <div className="border-line-soft flex flex-wrap items-end gap-3 rounded-row border p-3.5">
              <FieldBox className="min-w-40 flex-1">
                <Label htmlFor="tab-charge-received">Recibido</Label>
                <Input
                  id="tab-charge-received"
                  inputMode="decimal"
                  autoComplete="off"
                  className="font-mono tabular-nums"
                  placeholder={amountBlocker === null ? centsToAmount(amountCents) : undefined}
                  value={received}
                  onChange={(event) => setReceived(maskMoneyInput(event.target.value))}
                />
              </FieldBox>
              <div className="flex min-w-28 flex-col items-end pb-1">
                <span className="text-text-faint text-label">Vuelto</span>
                <span
                  className={
                    change !== null && change > 0
                      ? 'text-go-text text-figure tabular-nums'
                      : 'text-text text-figure tabular-nums'
                  }
                >
                  {change === null ? '—' : formatCents(change)}
                </span>
              </div>
            </div>
          ) : null}

          {amountBlocker === null && remaining > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-text-dim">Queda debiendo</span>
              <span className="text-text font-mono font-semibold tabular-nums [[data-density=bahia]_&]:text-title">
                {formatCents(remaining)}
              </span>
            </div>
          ) : null}

          {pay.error ? (
            <p className="text-danger-text text-body" role="alert">
              {chargeErrorMessage(pay.error)}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={blocker !== null}
            loading={pay.isPending}
            onClick={submit}
          >
            {blocker ?? chargeVerb(amountCents, balanceCents)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
