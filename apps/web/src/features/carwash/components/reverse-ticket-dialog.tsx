'use client';

import type { Ticket } from '@elite/shared';
import { useEffect, useState } from 'react';

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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/toast-provider';
import { referenceOf } from '../reference';
import { useReverseTicket } from '../hooks/use-tickets';

export function ReverseTicketDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reverse = useReverseTicket(ticket.id);
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const reference = referenceOf(ticket.number);
  const reset = reverse.reset;

  useEffect(() => {
    if (open) {
      reset();
      setReason('');
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deshacer el cobro #{reference}</DialogTitle>
          <DialogDescription>
            El lavado vuelve a listo y el cobro se saca de la caja abierta. Pedí un motivo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldBox>
            <Label htmlFor="reverse-reason">Motivo</Label>
            <Textarea
              id="reverse-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldBox>
          {reverse.error ? (
            <p className="text-danger-text text-body" role="alert">
              {reverse.error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            disabled={reason.trim().length < 3}
            loading={reverse.isPending}
            onClick={() =>
              reverse.mutate(
                { reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast({ title: `Cobro #${reference} deshecho` });
                    onOpenChange(false);
                  },
                },
              )
            }
          >
            Deshacer cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
