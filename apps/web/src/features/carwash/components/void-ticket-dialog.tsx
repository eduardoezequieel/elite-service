'use client';

import { useEffect } from 'react';
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
import { useToast } from '@/components/toast-provider';
import { referenceOf } from '../reference';
import { useTicketAction } from '../hooks/use-tickets';

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
  const voidTicket = useTicketAction('void');
  const { toast } = useToast();
  const reset = voidTicket.reset;

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  if (!ticket) return null;

  const reference = referenceOf(ticket.number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular el lavado #{reference}</DialogTitle>
          <DialogDescription>
            Se anula el lavado. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {voidTicket.error ? (
          <DialogBody>
            <p className="text-body text-danger-text" role="alert">
              {voidTicket.error.message}
            </p>
          </DialogBody>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            loading={voidTicket.isPending}
            onClick={() =>
              voidTicket.mutate(ticket.id, {
                onSuccess: () => {
                  toast({ title: `Lavado #${reference} anulado` });
                  onOpenChange(false);
                },
              })
            }
          >
            {voidTicket.isPending ? 'Anulando…' : 'Anular lavado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
