'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PAYMENT_METHOD_LABELS,
  RENTAL_PAYMENT_METHOD_ORDER,
  centsToMoney,
  createPaymentSchema,
} from '@elite/shared';
import type { CreatePaymentInput, PaymentMethod } from '@elite/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FieldError,
  FormAlert,
  TextAreaField,
  TextField,
} from '@/features/inventory/components/form-fields';
import { formatMoney } from '@/lib/money';
import { collectibleCents } from '../billing-format';
import { useAddRentalPayment } from '../hooks/use-rental-billing';

const METHOD_OPTIONS = RENTAL_PAYMENT_METHOD_ORDER.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
}));

type PaymentFormValues = z.input<typeof createPaymentSchema>;

/** Registrar un pago sobre una renta (098 RN-1). Arranca con el saldo completo. */
export function PaymentDialog({
  agreementId,
  balance,
  onClose,
}: {
  agreementId: string;
  balance: string;
  onClose: () => void;
}) {
  const addPayment = useAddRentalPayment(agreementId);
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PaymentFormValues, unknown, CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      amount: centsToMoney(collectibleCents(balance)),
      method: 'CASH',
      reference: '',
      note: '',
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit((input) => {
    setFormError(null);
    addPayment.mutate(input, {
      onSuccess: (payment) => {
        toast({
          title: 'Pago registrado',
          description: `${formatMoney(payment.amount)} · ${PAYMENT_METHOD_LABELS[payment.method]}`,
        });
        onClose();
      },
      onError: (error) => {
        if (error.code === 'PAYMENT_EXCEEDS_BALANCE') {
          form.setError('amount', { message: error.message });
          return;
        }
        setFormError(error.message);
      },
    });
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-md">
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Saldo pendiente: {formatMoney(balance)}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <TextField
              id="rental-payment-amount"
              label="Monto ($)"
              inputMode="decimal"
              placeholder="0.00"
              mono
              error={errors.amount?.message}
              {...form.register('amount')}
            />
            <div className="flex flex-col gap-1.5">
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Combobox
                    id="rental-payment-method"
                    label="Forma de pago"
                    options={METHOD_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value as PaymentMethod)}
                    onBlur={field.onBlur}
                    invalid={errors.method !== undefined}
                  />
                )}
              />
              <FieldError message={errors.method?.message} />
            </div>
            <TextField
              id="rental-payment-reference"
              label="Referencia (transferencia, voucher)"
              mono
              error={errors.reference?.message}
              {...form.register('reference')}
            />
            <TextAreaField
              id="rental-payment-note"
              label="Nota (opcional)"
              error={errors.note?.message}
              {...form.register('note')}
            />
            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={addPayment.isPending}>
              Registrar pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
