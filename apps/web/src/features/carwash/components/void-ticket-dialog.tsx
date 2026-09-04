'use client';

import { useEffect, useState } from 'react';
import type { Ticket } from '@elite/shared';

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
import { useVoidTicket } from '../hooks/use-tickets';

/**
 * Confirmación de anular. El único Anular relleno (`destructiveSolid`) vive
 * acá: en la ficha el botón sigue siendo el destructivo suave.
 */
export function VoidTicketDialog({
  open,
  onOpenChange,
  ticket,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket | null;
}) {
  const voidTicket = useVoidTicket();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const reset = voidTicket.reset;

  useEffect(() => {
    if (open) {
      reset();
      setReason('');
    }
  }, [open, reset]);

  if (!ticket) return null;

  const reference = referenceOf(ticket.number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular el lavado #{reference}</DialogTitle>
          <DialogDescription>
            Se anula el lavado. Esta acción no se puede deshacer. Pedí un motivo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FieldBox>
            <Label htmlFor="void-reason">Motivo</Label>
            <Textarea
              id="void-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldBox>
          {voidTicket.error ? (
            <p className="text-body text-danger-text" role="alert">
              {voidTicket.error.message}
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
            loading={voidTicket.isPending}
            onClick={() =>
              voidTicket.mutate(
                { id: ticket.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast({ title: `Lavado #${reference} anulado` });
                    onOpenChange(false);
                  },
                },
              )
            }
          >
            {voidTicket.isPending ? 'Anulando…' : 'Anular lavado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
