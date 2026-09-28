'use client';

import { PERMISSIONS } from '@elite/shared';
import type { CounterSale, CounterSaleItem } from '@elite/shared';
import { Ban, Lock } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { METHOD_LABELS, paymentDetailText } from '@/features/carwash/cash-format';
import { PaymentMethodStamp } from '@/features/carwash/components/payment-method-stamp';
import { dayLabel, timeLabel } from '@/lib/civil-date';
import { formatQuantity } from '@/lib/quantity';
import { cn } from '@/lib/utils';
import { useSale } from '../hooks/use-sales';
import { AccountTicketLinks } from './account-ticket-links';
import { SalePaymentsStamp, SaleStatusStamp } from './sale-stamps';
import { VoidSaleDialog } from './void-sale-dialog';

/**
 * `/sales/:id`: la ficha de una venta suelta (065). Qué se llevó, cómo se
 * pagó, quién vendió y cuándo; y, si es del turno abierto, «Anular venta»
 * (`carwash.void`, RN-22).
 */
export function SaleDetailScreen({ id }: { id: string }) {
  const sale = useSale(id);

  if (sale.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <ScreenHeader title="Venta" />
        <p className="text-text-faint text-body">Cargando…</p>
      </div>
    );
  }

  if (sale.error !== null) {
    return (
      <div className="flex flex-col gap-4">
        <ScreenHeader title="Venta" />
        <p className="text-danger-text text-body" role="alert">
          {sale.error.message}
        </p>
      </div>
    );
  }

  return <SaleDetail sale={sale.data} />;
}

function SaleDetail({ sale }: { sale: CounterSale }) {
  const { can } = usePermissions();
  const canVoid = can(PERMISSIONS.carwash.actions.void.key);
  const [voiding, setVoiding] = useState(false);
  const isVoid = sale.status === 'VOID';

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={sale.number}
        subtitle={`${dayLabel(sale.createdAt, { year: true })} · ${timeLabel(sale.createdAt)} · vendió ${sale.createdBy.fullName}`}
      >
        <Stamp tone="washing" label="Venta suelta" pulse={false} />
        <SaleStatusStamp status={sale.status} />
        {sale.isVoidable && canVoid ? (
          <Button type="button" variant="destructive" onClick={() => setVoiding(true)}>
            Anular venta
          </Button>
        ) : null}
      </ScreenHeader>

      {/* Solo se anula una venta del turno abierto (RN-22); lo decide el API
          en `isVoidable`, la pantalla no repite la regla. */}
      {!isVoid && !sale.isVoidable ? (
        <p className="text-text-dim text-body" role="status">
          El turno de esta venta ya cerró.
        </p>
      ) : null}

      {isVoid ? (
        <div
          role="status"
          className="tint text-danger-text flex items-start gap-2.5 rounded-row border px-3.5 py-3"
        >
          <Ban aria-hidden strokeWidth={1.5} className="size-icon mt-0.5 shrink-0" />
          <p className="text-body">
            <b className="font-semibold">Anulada</b>
            {sale.voidedBy === null ? '' : ` por ${sale.voidedBy.fullName}`}
            {sale.voidedAt === null
              ? ''
              : ` el ${dayLabel(sale.voidedAt, { year: true })} a las ${timeLabel(sale.voidedAt)}`}
            {sale.voidReason === null ? '' : ` · «${sale.voidReason}»`}. Los productos volvieron al
            inventario y los pagos salieron del turno.
          </p>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card className="gap-2.5 px-card">
          <CardSectionHeading aside="sin comisión">Productos</CardSectionHeading>
          {sale.items.map((item) => (
            <SaleItemLine key={item.id} item={item} />
          ))}
          <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
            <span className="text-text-faint text-label">Total</span>
            <span className={cn('text-figure text-text tabular-nums', isVoid && 'is-ruled-out')}>
              ${sale.total}
            </span>
          </div>
        </Card>

        <Card className="gap-3 px-card">
          <CardSectionHeading
            aside={isVoid ? 'salieron del turno' : <SalePaymentsStamp payments={sale.payments} />}
          >
            Pagos
          </CardSectionHeading>

          {sale.accountTickets.length > 0 && sale.payments.length > 0 ? (
            <p className="text-text-faint text-dense">
              Lo que le tocó a la venta del pago de la cuenta: el resto quedó en los lavados.
            </p>
          ) : null}

          {sale.payments.length === 0 ? (
            <p className="text-text-dim text-body">
              Sin pagos: salieron del turno al anular la venta.
            </p>
          ) : (
            sale.payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <PaymentMethodStamp method={payment.method} />
                  {/* La cuenta y la referencia, o qué fue (069). */}
                  {paymentDetailText(payment) === null ? null : (
                    <span className="text-text-dim text-dense min-w-0 break-words">
                      {paymentDetailText(payment)}
                    </span>
                  )}
                </span>
                <span className="text-text font-mono tabular-nums">
                  <span className="sr-only">{METHOD_LABELS[payment.method]}: </span>$
                  {payment.amount}
                </span>
              </div>
            ))
          )}

          <div className="border-line-soft mt-1 flex flex-col gap-3 border-t pt-3">
            <Field label="Vendió" value={sale.createdBy.fullName} />
            <Field
              label="Fecha y hora"
              value={`${dayLabel(sale.createdAt, { year: true })}, ${timeLabel(sale.createdAt)}`}
            />
            <Field label="Cliente" value={sale.customerName ?? 'Sin nombre'} />
            {sale.charge === null ? null : (
              <Field
                label="Cuenta"
                value={<span className="font-mono">{sale.charge.number}</span>}
              />
            )}
            {sale.accountTickets.length === 0 ? null : (
              <Field label="Lavados" value={<AccountTicketLinks tickets={sale.accountTickets} />} />
            )}
            {sale.cashTendered === null ? null : (
              <Field label="Con cuánto pagó" value={`$${sale.cashTendered}`} />
            )}
            {sale.changeGiven === null ? null : (
              <Field
                label="Cambio al cliente"
                value={<span className="text-go-text font-semibold">${sale.changeGiven}</span>}
              />
            )}
          </div>
        </Card>
      </div>

      {voiding ? <VoidSaleDialog sale={sale} onOpenChange={setVoiding} /> : null}
    </div>
  );
}

/**
 * Una línea vendida: `2 × $3.00 = $6.00`, con el precio del catálogo tachado y
 * la firma debajo cuando se cobró por debajo (060).
 */
function SaleItemLine({ item }: { item: CounterSaleItem }) {
  const changed = item.unitPrice !== item.catalogPrice;

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <span className="flex min-w-0 flex-col">
        <span className="text-text text-body font-semibold [[data-density=bahia]_&]:text-title">
          {item.name}
        </span>
        <span className="text-text-faint text-dense">
          <span className="font-mono">{item.code}</span>
          {item.priceAuthorizedBy === null ? null : (
            <span className="text-warn-text">
              {' · '}
              <Lock aria-hidden strokeWidth={1.5} className="inline size-3.5 align-[-2px]" />{' '}
              Autorizó {item.priceAuthorizedBy.fullName}
              {item.priceReason === null ? '' : ` · ${item.priceReason}`}
            </span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-baseline gap-2 font-mono tabular-nums">
        {changed ? (
          <span className="text-text-faint is-ruled-out text-dense">${item.catalogPrice}</span>
        ) : null}
        {/* El total de la línea es el que guardó el API, no una cuenta nueva. */}
        <span className="text-text-dim">
          {formatQuantity(item.quantity)} × ${item.unitPrice} ={' '}
          <b className="text-text font-semibold">${item.total}</b>
        </span>
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-right text-body">{value}</span>
    </div>
  );
}
