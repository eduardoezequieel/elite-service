'use client';

import { PAYMENT_METHOD_LABELS, voidPaymentSchema } from '@elite/shared';
import type { RentalPayment } from '@elite/shared';
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
import { FormAlert, TextAreaField } from '@/features/inventory/components/form-fields';
import { formatMoney } from '@/lib/money';
import { useVoidRentalPayment } from '../hooks/use-rental-billing';

/** Anular un pago con motivo (098 RN-1): no se borra, deja de sumar. */
export function VoidPaymentDialog({
  payment,
  onClose,
}: {
  payment: RentalPayment;
  onClose: () => void;
}) {
  const voidPayment = useVoidRentalPayment();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const submit = () => {
    const parsed = voidPaymentSchema.safeParse({ reason });

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    voidPayment.mutate(
      { paymentId: payment.id, input: parsed.data },
      {
        onSuccess: () => {
          toast({ title: 'Pago anulado', description: formatMoney(payment.amount) });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular pago</DialogTitle>
          <DialogDescription>
            {formatMoney(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method]} · recibió{' '}
            {payment.receivedByName}. Deja de sumar al pagado, pero queda escrito.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <TextAreaField
            id="rental-void-reason"
            label="Motivo"
            value={reason}
            error={fieldError}
            onChange={(event) => setReason(event.target.value)}
          />
          <FormAlert message={voidPayment.error?.message ?? null} />
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            loading={voidPayment.isPending}
            onClick={submit}
          >
            Anular pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
