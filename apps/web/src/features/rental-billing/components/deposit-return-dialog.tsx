'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { depositReturnSchema, moneyToCents } from '@elite/shared';
import type { DepositReturnInput } from '@elite/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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
import { FormAlert, TextAreaField, TextField } from '@/features/inventory/components/form-fields';
import { formatCents, formatMoney, parseCents } from '@/lib/money';
import { useReturnRentalDeposit } from '../hooks/use-rental-billing';

type DepositFormValues = z.input<typeof depositReturnSchema>;

/**
 * Devolver el depósito (098 RN-2): una sola vez, total o parcial. Si se
 * retiene una parte, la nota dice por qué. Sin forma de devolución: la tabla
 * todavía no tiene dónde guardarla, y un campo que no se guarda engaña.
 */
export function DepositReturnDialog({
  agreementId,
  deposit,
  onClose,
}: {
  agreementId: string;
  deposit: string;
  onClose: () => void;
}) {
  const returnDeposit = useReturnRentalDeposit(agreementId);
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<DepositFormValues, unknown, DepositReturnInput>({
    resolver: zodResolver(depositReturnSchema),
    defaultValues: { amount: deposit, note: '' },
  });
  const errors = form.formState.errors;
  const typed = form.watch('amount');
  const retained = moneyToCents(deposit) - parseCents(String(typed ?? ''));

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    returnDeposit.mutate(input, {
      onSuccess: () => {
        toast({ title: 'Depósito devuelto', description: formatMoney(input.amount) });
        onClose();
      },
      onError: (error) => {
        const details = error.details as Record<string, unknown> | undefined;

        if (typeof details?.note === 'string') form.setError('note', { message: details.note });
        if (error.code === 'DEPOSIT_EXCEEDS_HELD')
          form.setError('amount', { message: error.message });
        setFormError(error.message);
      },
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-md">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Devolver depósito</DialogTitle>
            <DialogDescription>
              En custodia: {formatMoney(deposit)}. Se devuelve una sola vez.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <TextField
              id="rental-deposit-amount"
              label="Monto a devolver ($)"
              inputMode="decimal"
              placeholder="0.00"
              mono
              error={errors.amount?.message}
              {...form.register('amount')}
            />
            {retained > 0 ? (
              <p className="text-warn-text text-body">Se retienen {formatCents(retained)}.</p>
            ) : null}
            <TextAreaField
              id="rental-deposit-note"
              label={retained > 0 ? 'Por qué se retiene' : 'Nota (opcional)'}
              error={errors.note?.message}
              {...form.register('note')}
            />
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={returnDeposit.isPending}>
              Devolver depósito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
