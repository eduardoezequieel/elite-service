'use client';

import type { AuthorizationInput, PriceAuthorizationInput } from '@elite/shared';
import { Lock } from 'lucide-react';
import { useState } from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import {
  AuthorizationFields,
  EMPTY_AUTHORIZATION,
} from '@/features/auth/components/authorization-fields';
import { maskMoneyInput } from '@/features/carwash/pricing';
import { centsToAmount, parseCents } from '@/lib/money';
import { isPriceAuthorizationFilled, type CartLine } from '../sale-cart';

/**
 * El candado del precio en la venta suelta (060, RN-21).
 *
 * Mismo gesto que `ChangePriceDialog` del lavado —precio, motivo y la firma de
 * quien tiene `carwash.discount`—, pero **no llama al API**: la venta todavía
 * no existe (RN-18). La firma viaja con el cobro en `priceAuthorization` y el
 * API la verifica ahí; si la rechaza, la contraseña se borra y el botón de
 * cobrar vuelve a pedirla.
 *
 * Una venta lleva **una** firma para todas sus líneas rebajadas: al abrir el
 * candado de otra línea, el motivo y el correo ya vienen puestos.
 */
export function SalePriceDialog({
  line,
  authorization,
  open,
  onOpenChange,
  onApply,
}: {
  line: CartLine;
  /** La firma que ya lleva la venta, o `null`. */
  authorization: PriceAuthorizationInput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El precio nuevo y la firma; `null` si el precio vuelve al catálogo. */
  onApply: (unitPrice: string, authorization: PriceAuthorizationInput | null) => void;
}) {
  // Se monta al abrir (la pantalla lo dibuja solo con una línea elegida), así
  // que el estado arranca de la línea y de la firma de ese momento.
  const [unitPrice, setUnitPrice] = useState(line.unitPrice);
  const [reason, setReason] = useState(authorization?.reason ?? '');
  const [credentials, setCredentials] = useState<AuthorizationInput>(
    authorization?.authorization ?? EMPTY_AUTHORIZATION,
  );

  const typed = unitPrice.trim() !== '';
  const cents = parseCents(unitPrice);
  const catalogCents = parseCents(line.catalogPrice);
  const aboveCatalog = cents > catalogCents;
  const backToCatalog = typed && cents === catalogCents;
  const signature: PriceAuthorizationInput = {
    reason: reason.trim(),
    authorization: { ...credentials, email: credentials.email.trim() },
  };
  const ready = typed && !aboveCatalog && (backToCatalog || isPriceAuthorizationFilled(signature));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar el precio</DialogTitle>
          <DialogDescription>{line.name} · venta suelta</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <p className="text-text-faint text-label">Precio del catálogo</p>
              <p className="text-text text-title mt-1 font-mono tabular-nums">
                ${line.catalogPrice}
              </p>
            </div>
            <FieldBox className="min-w-[140px] flex-1">
              <Label htmlFor="sale-price-new">Precio nuevo por unidad</Label>
              <Input
                id="sale-price-new"
                inputMode="decimal"
                autoComplete="off"
                className="font-mono tabular-nums"
                value={unitPrice}
                aria-invalid={aboveCatalog}
                onChange={(event) => setUnitPrice(maskMoneyInput(event.target.value))}
              />
            </FieldBox>
          </div>
          {aboveCatalog ? (
            <p className="text-danger-text text-dense" role="alert">
              El precio no puede pasar del catálogo. Para cobrar de más se corrige el artículo.
            </p>
          ) : null}

          {backToCatalog ? (
            <p className="text-text-dim text-dense">
              Vuelve al precio del catálogo: no pide firma.
            </p>
          ) : (
            <>
              <FieldBox>
                <Label htmlFor="sale-price-reason">Motivo</Label>
                <Textarea
                  id="sale-price-reason"
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FieldBox>

              <AuthorizationFields
                idPrefix="sale-price"
                value={credentials}
                onChange={setCredentials}
              />

              <p className="text-text-faint text-dense">
                La firma se revisa al cobrar y cubre todas las líneas rebajadas de esta venta. Queda
                anotado quién autorizó, el precio del catálogo y el motivo.
              </p>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!ready}
            onClick={() => {
              onApply(centsToAmount(cents), backToCatalog ? null : signature);
              onOpenChange(false);
            }}
          >
            <Lock aria-hidden strokeWidth={1.5} />
            {backToCatalog ? 'Volver al precio del catálogo' : 'Aplicar precio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
