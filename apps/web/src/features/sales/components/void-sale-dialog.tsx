'use client';

import type { AuthorizationInput, CounterSale } from '@elite/shared';
import { TriangleAlert } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AuthorizationFields,
  EMPTY_AUTHORIZATION,
} from '@/features/auth/components/authorization-fields';
import { timeLabel } from '@/lib/civil-date';
import { useVoidSale } from '../hooks/use-sales';
import { isVoidReady } from '../sale-cart';
import { accountTicketsLabel, productsSummary } from '../sale-format';

/**
 * «Anular venta» (RN-22). Pide lo mismo que deshacer un cobro (045): un motivo
 * y las credenciales de quien tiene `carwash.void`, tecleadas acá. No abre
 * sesión ni cambia el usuario de la pantalla, y si el API rechaza, la
 * contraseña se borra del campo.
 *
 * Solo se anula una venta del turno abierto: si el turno ya cerró, el API
 * responde `CASH_SESSION_GONE` y el mensaje queda al pie del diálogo.
 *
 * Se monta al abrir, así que cada apertura arranca en blanco.
 */
export function VoidSaleDialog({
  sale,
  onOpenChange,
}: {
  sale: CounterSale;
  onOpenChange: (open: boolean) => void;
}) {
  const voidSale = useVoidSale(sale.id);
  // Anular la venta deshace su cuenta entera (066): los lavados cobrados con
  // ella vuelven a listo. Se dice antes de pulsar.
  const washesLabel = accountTicketsLabel(sale.accountTickets);
  const washesNote =
    washesLabel === null
      ? null
      : `${washesLabel}: se deshace la cuenta entera y esos lavados vuelven a listo.`;
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [authorization, setAuthorization] = useState<AuthorizationInput>(EMPTY_AUTHORIZATION);
  const pending = voidSale.isPending;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular la venta {sale.number}</DialogTitle>
          <DialogDescription>
            Pide lo mismo que deshacer un cobro: el motivo y la autorización de un administrador.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="border-line-soft bg-surface-2 flex items-baseline justify-between gap-3 rounded-row border px-3.5 py-2.5">
            <span className="text-text-dim min-w-0 text-dense">
              {timeLabel(sale.createdAt)} · {productsSummary(sale.items)}
            </span>
            <span className="text-text shrink-0 font-mono font-semibold tabular-nums">
              ${sale.total}
            </span>
          </div>

          <FieldBox>
            <Label htmlFor="void-sale-reason">Motivo</Label>
            <Textarea
              id="void-sale-reason"
              rows={3}
              value={reason}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
            />
          </FieldBox>

          <AuthorizationFields
            idPrefix="void-sale"
            value={authorization}
            onChange={setAuthorization}
            disabled={pending}
          />

          <p className="text-warn-text text-dense flex items-start gap-2" role="note">
            <TriangleAlert aria-hidden strokeWidth={1.5} className="size-icon mt-px shrink-0" />
            <span>
              Los productos vuelven al inventario y los pagos salen del turno. La venta no se borra:
              queda anulada con quién, cuándo y por qué.
              {washesNote === null ? null : (
                <>
                  {' '}
                  <b className="font-semibold">{washesNote}</b>
                </>
              )}
            </span>
          </p>

          {voidSale.error ? (
            <p className="text-danger-text text-body" role="alert">
              {voidSale.error.message}
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
            disabled={!isVoidReady(reason, authorization)}
            loading={pending}
            onClick={() =>
              voidSale.mutate(
                {
                  reason: reason.trim(),
                  authorization: { ...authorization, email: authorization.email.trim() },
                },
                {
                  onSuccess: () => {
                    toast({
                      title: `Venta ${sale.number} anulada`,
                      description: 'Los productos volvieron al inventario.',
                    });
                    onOpenChange(false);
                  },
                  // La contraseña del que autoriza no se queda escrita (045 RN-5).
                  onError: () => setAuthorization(EMPTY_AUTHORIZATION),
                },
              )
            }
          >
            Anular venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
