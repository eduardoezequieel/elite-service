'use client';

import type { AuthorizationInput, Ticket } from '@elite/shared';
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
import {
  AuthorizationFields,
  EMPTY_AUTHORIZATION,
  isAuthorizationFilled,
} from '@/features/auth/components/authorization-fields';
import { referenceOf } from '../reference';
import { useReverseTicket } from '../hooks/use-tickets';

/**
 * Confirmación de deshacer un cobro. Como anular, no la autoriza la sesión sino
 * quien escribe acá sus credenciales y tiene `carwash.reverse` (spec 045).
 */
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
  const [authorization, setAuthorization] = useState<AuthorizationInput>(EMPTY_AUTHORIZATION);
  const reference = referenceOf(ticket.number);
  const reset = reverse.reset;

  useEffect(() => {
    if (open) {
      reset();
      setReason('');
      setAuthorization(EMPTY_AUTHORIZATION);
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
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
          <AuthorizationFields
            idPrefix="reverse"
            value={authorization}
            onChange={setAuthorization}
            disabled={reverse.isPending}
          />
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
            disabled={reason.trim().length < 3 || !isAuthorizationFilled(authorization)}
            loading={reverse.isPending}
            onClick={() =>
              reverse.mutate(
                {
                  reason: reason.trim(),
                  authorization: { ...authorization, email: authorization.email.trim() },
                },
                {
                  onSuccess: () => {
                    toast({ title: `Cobro #${reference} deshecho` });
                    onOpenChange(false);
                  },
                  // La contraseña no se queda escrita tras un rechazo.
                  onError: () => setAuthorization(EMPTY_AUTHORIZATION),
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
