'use client';

import type { AuthorizationInput, Ticket, VoidChargeInput } from '@elite/shared';
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
import { useReverseTicket, useVoidCharge } from '../hooks/use-tickets';
import { voidChargeWarning } from '../ticket-payments';

/**
 * Confirmación de deshacer un cobro. Como anular, no la autoriza la sesión sino
 * quien escribe acá sus credenciales y tiene `carwash.reverse` (spec 045).
 *
 * Desde la 059 lo que se deshace es **la cuenta**, no el lavado: si se cobraron
 * tres juntos, los tres vuelven a listo y sus pagos salen del turno (RN-8). El
 * aviso lo dice antes de que alguien pulse, porque nadie espera que deshacer
 * «este cobro» mueva otros dos carros.
 *
 * Un cobro anterior a la 059 no tiene cuenta: ese sigue yendo por el camino
 * viejo, que deshace el lavado suelto.
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
  const account = ticket.charge;
  const voidCharge = useVoidCharge(account?.id ?? '');
  const reverseTicket = useReverseTicket(ticket.id);
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [authorization, setAuthorization] = useState<AuthorizationInput>(EMPTY_AUTHORIZATION);
  const reference = referenceOf(ticket.number);
  const warning = voidChargeWarning(account);
  const pending = account === null ? reverseTicket.isPending : voidCharge.isPending;
  const error = account === null ? reverseTicket.error : voidCharge.error;
  const resetCharge = voidCharge.reset;
  const resetTicket = reverseTicket.reset;

  useEffect(() => {
    if (open) {
      resetCharge();
      resetTicket();
      setReason('');
      setAuthorization(EMPTY_AUTHORIZATION);
    }
  }, [open, resetCharge, resetTicket]);

  function run(input: VoidChargeInput): void {
    const handlers = {
      onSuccess: () => {
        toast({
          title:
            account === null || account.ticketCount <= 1
              ? `Cobro #${reference} deshecho`
              : `Cuenta ${account.number} deshecha`,
        });
        onOpenChange(false);
      },
      // La contraseña no se queda escrita tras un rechazo.
      onError: () => setAuthorization(EMPTY_AUTHORIZATION),
    };

    if (account === null) reverseTicket.mutate(input, handlers);
    else voidCharge.mutate(input, handlers);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {account === null || account.ticketCount <= 1
              ? `Deshacer el cobro #${reference}`
              : `Deshacer la cuenta ${account.number}`}
          </DialogTitle>
          <DialogDescription>
            El lavado vuelve a listo y el cobro se saca de la caja abierta. Pedí un motivo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {warning === null ? null : (
            <p className="text-warn-text text-body" role="note">
              {warning}
            </p>
          )}
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
            disabled={pending}
          />
          {error ? (
            <p className="text-danger-text text-body" role="alert">
              {error.message}
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
            loading={pending}
            onClick={() =>
              run({
                reason: reason.trim(),
                authorization: { ...authorization, email: authorization.email.trim() },
              })
            }
          >
            {account === null || account.ticketCount <= 1 ? 'Deshacer cobro' : 'Deshacer la cuenta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
