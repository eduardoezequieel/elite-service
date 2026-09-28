'use client';

import type { AuthorizationInput, Ticket, TicketItem } from '@elite/shared';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { Textarea } from '@/components/ui/textarea';
import {
  AuthorizationFields,
  EMPTY_AUTHORIZATION,
  isAuthorizationFilled,
} from '@/features/auth/components/authorization-fields';
import { parseCents } from '@/lib/money';
import { useAuthorizePrice } from '../hooks/use-tickets';
import { maskMoneyInput } from '../pricing';
import { isProductLine, lineFormula, toMilli } from '../product-lines';
import { referenceOf } from '../reference';

/**
 * Cambiar el precio de una línea con el lavado ya listo (060).
 *
 * El cajero teclea el precio y el motivo, pero **lo aplica la firma de un
 * administrador**: correo y contraseña ahí mismo, como en la 045. No abre
 * sesión, no cambia el usuario de la pantalla y la contraseña no se guarda; si
 * el API rechaza, se borra del campo.
 *
 * El precio del catálogo queda a la vista al lado del campo: es el techo, y el
 * API responde `PRICE_ABOVE_CATALOG` si se lo pasa. Acá se avisa antes para no
 * mandar al usuario al viaje de ida y vuelta.
 *
 * En un producto (065 RN-7) lo que se cambia es el precio **por unidad**: la
 * cantidad queda como está y debajo se ve cuánto va a sumar la línea.
 */
export function ChangePriceDialog({
  ticket,
  item,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  item: TicketItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const authorize = useAuthorizePrice(ticket.id, item.id);
  const { toast } = useToast();
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);
  const [reason, setReason] = useState('');
  const [authorization, setAuthorization] = useState<AuthorizationInput>(EMPTY_AUTHORIZATION);
  const reference = referenceOf(ticket.number);
  const reset = authorize.reset;
  const current = item.unitPrice;

  useEffect(() => {
    if (open) {
      reset();
      setUnitPrice(current);
      setReason('');
      setAuthorization(EMPTY_AUTHORIZATION);
    }
  }, [open, reset, current]);

  const cents = parseCents(unitPrice);
  const catalogCents = parseCents(item.catalogPrice);
  const aboveCatalog = cents > catalogCents;
  const typed = unitPrice.trim() !== '';
  const product = isProductLine(item);
  const milli = toMilli(item.quantity);
  const ready =
    typed && !aboveCatalog && reason.trim().length >= 3 && isAuthorizationFilled(authorization);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar el precio</DialogTitle>
          <DialogDescription>
            <span className="flex flex-wrap items-center gap-2">
              {item.name}
              <span className="font-mono">#{reference}</span>
              <PlateChip plate={ticket.vehicle.plate} size="sm" />
            </span>
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <p className="text-text-faint text-label">
                {product ? 'Precio del catálogo, por unidad' : 'Precio del catálogo'}
              </p>
              <p className="text-text text-title mt-1 font-mono tabular-nums">
                ${item.catalogPrice}
              </p>
            </div>
            <FieldBox className="min-w-[140px] flex-1">
              <Label htmlFor="price-new">
                {product ? 'Precio nuevo por unidad' : 'Precio nuevo'}
              </Label>
              <Input
                id="price-new"
                inputMode="decimal"
                autoComplete="off"
                className="font-mono tabular-nums"
                value={unitPrice}
                aria-invalid={aboveCatalog}
                disabled={authorize.isPending}
                onChange={(event) => setUnitPrice(maskMoneyInput(event.target.value))}
              />
            </FieldBox>
          </div>
          {product && typed && !aboveCatalog ? (
            <p className="text-text-dim font-mono text-dense tabular-nums">
              {lineFormula(unitPrice, milli)}
            </p>
          ) : null}
          {aboveCatalog ? (
            <p className="text-danger-text text-dense">
              El precio no puede pasar del catálogo. Para cobrar de más se corrige el catálogo.
            </p>
          ) : null}

          <FieldBox>
            <Label htmlFor="price-reason">Motivo</Label>
            <Textarea
              id="price-reason"
              rows={2}
              value={reason}
              disabled={authorize.isPending}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldBox>

          <AuthorizationFields
            idPrefix="price"
            value={authorization}
            onChange={setAuthorization}
            disabled={authorize.isPending}
          />

          {authorize.error ? (
            <p className="text-danger-text text-body" role="alert">
              {authorize.error.message}
            </p>
          ) : null}

          <p className="text-text-faint text-dense">
            Queda firmado quién autorizó, el precio anterior y el motivo.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!ready}
            loading={authorize.isPending}
            onClick={() =>
              authorize.mutate(
                {
                  unitPrice,
                  reason: reason.trim(),
                  authorization: { ...authorization, email: authorization.email.trim() },
                },
                {
                  onSuccess: () => {
                    toast({ title: `Precio cambiado en #${reference}` });
                    onOpenChange(false);
                  },
                  // La contraseña del que autoriza no se queda escrita tras un
                  // rechazo (045 RN-5).
                  onError: () => setAuthorization(EMPTY_AUTHORIZATION),
                },
              )
            }
          >
            <Lock aria-hidden strokeWidth={1.5} />
            Autorizar y aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
