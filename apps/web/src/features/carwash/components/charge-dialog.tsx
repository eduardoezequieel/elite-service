'use client';

import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type { PaymentMethod, Ticket } from '@elite/shared';
import * as React from 'react';

import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { listCustomers, matchCustomer } from '@/features/customers/api';
import { EMPTY_CUSTOMER, OwnerField, type CustomerDraft } from './customer-field';
import { TicketNoteField } from './ticket-note-field';
import { useTicketNote } from '../use-ticket-note';
import {
  useCreateCharge,
  useSetTicketResponsible,
  useTickets,
  useUpdateTicketNotes,
} from '../hooks/use-tickets';
import { responsibleOf } from '../responsible';
import { referenceOf } from '../reference';
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
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import {
  AccountProductLines,
  AccountProductSearch,
} from '@/features/sales/components/account-products';
import { useAccountProducts } from '@/features/sales/hooks/use-account-products';
import { buildChargeInput } from '@/features/sales/sale-cart';
import { useCurrentCashSession, useOpenCash } from '../hooks/use-cash';
import {
  accountBuckets,
  accountTotalCents,
  cashDueCents,
  changeCents,
  chargeBlocker,
  fitLastLine,
  isCashShort,
  type PaymentLine,
} from '../charge-math';
import { formatMoney } from '../pricing';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { ChargeAccount } from './charge-account';
import { ChargeTicketPicker } from './charge-ticket-picker';
import { CashBox, METHODS, MethodPicker, SplitPaymentLines, SpreadDetails } from './charge-payment';

/**
 * El cobro (059).
 *
 * Una sola pantalla para los tres casos, porque para el cajero son el mismo
 * gesto: un lavado y un método —lo de todos los días, que no cambió de forma—,
 * varios lavados en una cuenta, o un pago partido en métodos. Todo sale por
 * `POST /carwash/charges`, también el caso de uno: no hay dos caminos para
 * cobrar.
 *
 * Lo que la pantalla no deja hacer nunca es mandar una cuenta que no cuadra. El
 * botón primario dice qué falta —«Falta $1.50», «Falta efectivo»— y no llama al
 * API hasta que deje de faltar. El API vuelve a validar lo mismo
 * (`PAYMENT_AMOUNT_MISMATCH`, `CASH_TENDERED_SHORT`); esto no lo reemplaza, le
 * evita el viaje al que tiene el cliente enfrente.
 *
 * El precio no se edita acá (060): se muestra como texto y el candado pide la
 * firma de un administrador.
 *
 * Desde la 066 la cuenta puede llevar además **productos sueltos** —«Sumar
 * productos sueltos»—: el mismo bloque de «Nueva venta», que se guarda como una
 * venta suelta colgada de esta misma cuenta. Un solo pago, un solo vuelto, y
 * la venta es una parte más del reparto.
 */
export function ChargeDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [method, setMethod] = React.useState<PaymentMethod>('CASH');
  const [split, setSplit] = React.useState(false);
  const [lines, setLines] = React.useState<PaymentLine[]>([]);
  const [tendered, setTendered] = React.useState('');
  const [extraIds, setExtraIds] = React.useState<readonly string[]>([]);
  const [picking, setPicking] = React.useState(false);
  const [withProducts, setWithProducts] = React.useState(false);
  const [openingFloat, setOpeningFloat] = React.useState('0.00');
  const [customer, setCustomer] = React.useState<CustomerDraft>(EMPTY_CUSTOMER);
  // El ticket llega fresco de la lista, así que la nota que guarde la pista
  // aparece acá sola. Lo que el cajero esté escribiendo no se pisa (041, 042).
  const note = useTicketNote(ticket.notes);
  const charge = useCreateCharge();
  const resetCharge = charge.reset;
  const staleError = charge.error !== null && charge.error.code !== API_ERROR_CODES.CASH_NOT_OPEN;
  const products = useAccountProducts({
    enabled: open && withProducts,
    // Cambiar los productos después de un rechazo lo deja atrás.
    onEdit: React.useCallback(() => {
      if (staleError) resetCharge();
    }, [staleError, resetCharge]),
  });
  const link = useSetTicketResponsible(ticket.id);
  const updateNotes = useUpdateTicketNotes(ticket.id);
  const existing = responsibleOf(ticket);
  const openCash = useOpenCash();
  const { can } = usePermissions();
  const canCash = can(PERMISSIONS.carwash.actions.cash.key);
  const current = useCurrentCashSession(canCash);
  const { toast } = useToast();
  // Los que se sumaron a la cuenta se releen de la consulta, nunca de una copia
  // guardada: si otra caja cobró uno mientras esto estaba abierto, sale solo
  // (convención 15).
  const ready = useTickets({ status: 'READY' }, open && extraIds.length > 0);
  const extras = extraIds
    .map((id) => (ready.data ?? []).find((row) => row.id === id))
    .filter((row): row is Ticket => row !== undefined && row.payments.length === 0);
  const account = [ticket, ...extras];
  const hasProducts = products.lines.length > 0;
  const single = account.length === 1 && !hasProducts;
  // Las partes del reparto, en el orden del API: los lavados y la venta al final.
  const buckets = accountBuckets(account, hasProducts ? products.totalCents : null);

  const totalCents = accountTotalCents(buckets);
  const cashDue = cashDueCents({ totalCents, split, lines, method });
  const change = changeCents(tendered, cashDue);
  const short = isCashShort(tendered, cashDue);
  const blocker =
    products.blocker ?? chargeBlocker({ totalCents, split, lines, tendered, cashDue });
  const chosen = METHODS.find((option) => option.value === method);
  const reference = referenceOf(ticket.number);
  const cashQueryFailed = canCash && current.error !== null;
  const apiBlocked = charge.error?.code === API_ERROR_CODES.CASH_NOT_OPEN;
  const cashClosed = canCash && !current.isPending && !cashQueryFailed && current.data === null;
  const blocked = (cashClosed || apiBlocked) && !cashQueryFailed;
  const waitingCash = canCash && current.isPending;

  /**
   * Si la cuenta cambia de total —se sumó un lavado, se quitó uno, se autorizó
   * un precio— la diferencia cae en el último renglón. Teclear un monto no
   * mueve el total, así que esto no pisa lo que el cajero está escribiendo.
   */
  React.useEffect(() => {
    setLines((previous) => (previous.length === 0 ? previous : fitLastLine(previous, totalCents)));
  }, [totalCents]);

  function close(next: boolean): void {
    if (!next) {
      setMethod('CASH');
      setSplit(false);
      setLines([]);
      setTendered('');
      setExtraIds([]);
      setPicking(false);
      setWithProducts(false);
      products.reset();
      setCustomer(EMPTY_CUSTOMER);
      note.reset();
      charge.reset();
      link.reset();
      updateNotes.reset();
    }

    onOpenChange(next);
  }

  async function persistNotesIfDirty(): Promise<boolean> {
    if (note.value.trim() === (ticket.notes ?? '').trim()) return true;

    try {
      await updateNotes.mutateAsync(note.value.trim());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * El responsable que se escribió y no se vinculó a mano. La cuenta ya no lo
   * lleva adentro —un cobro puede ser de varios carros—, así que se pega al
   * carro antes de cobrar, que es lo que hacía el endpoint viejo.
   */
  async function linkResponsibleIfDrafted(): Promise<boolean> {
    if (existing !== null || account.length > 1) return true;
    if (customer.customerId === undefined && customer.fullName.trim().length < 2) return true;

    try {
      await link.mutateAsync(
        customer.customerId
          ? { customerId: customer.customerId }
          : {
              customer: {
                fullName: customer.fullName.trim(),
                phone: customer.phone.trim() || undefined,
              },
            },
      );
      return true;
    } catch {
      return false;
    }
  }

  function submit(): void {
    if (blocked || blocker !== null) return;

    void persistNotesIfDirty().then(async (ok) => {
      if (!ok) return;
      if (!(await linkResponsibleIfDrafted())) return;

      charge.mutate(
        buildChargeInput({
          workOrderIds: account.map((row) => row.id),
          lines: products.lines,
          // La venta suelta lleva el nombre del responsable, si el lavado tiene.
          customerName: existing?.fullName ?? '',
          split,
          method,
          payments: lines,
          tendered,
          cashDue,
          totalCents,
          priceAuthorization: products.priceAuthorization,
        }),
        {
          onSuccess: (result) => {
            toast({
              title: chargedTitle(reference, account.length, result.counterSale?.number ?? null),
              description:
                change > 0
                  ? `$${formatMoney(totalCents)} · cambio $${formatMoney(change)}`
                  : `$${formatMoney(totalCents)}`,
            });
            close(false);
          },
          onError: products.absorbError,
        },
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="md:max-w-2xl xl:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{single ? 'Cobrar el lavado' : 'Cobrar la cuenta'}</DialogTitle>
          <DialogDescription>
            {single
              ? 'Después de cobrar, el lavado ya no se edita.'
              : `${accountLabel(account.length, hasProducts)} en una sola cuenta. Después de cobrar ya no se editan.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {cashQueryFailed ? (
            <p className="text-danger-text text-body" role="alert">
              {current.error?.message ?? 'No se pudo saber si la caja está abierta.'}
            </p>
          ) : blocked ? (
            <div className="flex flex-col gap-3">
              <p className="text-danger-text text-body" role="alert">
                Abrí la caja para cobrar.
              </p>
              {canCash ? (
                <>
                  <FieldBox>
                    <Label htmlFor="charge-float">Fondo</Label>
                    <Input
                      id="charge-float"
                      value={openingFloat}
                      onChange={(event) => setOpeningFloat(event.target.value)}
                      inputMode="decimal"
                      className="font-mono"
                    />
                  </FieldBox>
                  <Button
                    type="button"
                    loading={openCash.isPending}
                    onClick={() =>
                      openCash.mutate(
                        { openingFloat },
                        {
                          onSuccess: () => {
                            toast({ title: 'Caja abierta' });
                            charge.reset();
                          },
                        },
                      )
                    }
                  >
                    Abrir caja y seguir
                  </Button>
                  {openCash.error ? (
                    <p className="text-danger-text text-body" role="alert">
                      {openCash.error.message}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            // En escritorio ancho, dos columnas: qué se cobra y de quién a la
            // izquierda, cómo se paga a la derecha. Abajo de 1180px se apilan.
            <div className="flex flex-col gap-5 xl:grid xl:grid-cols-2 xl:items-start xl:gap-8">
              <div className="flex min-w-0 flex-col gap-5">
                <ChargeAccount
                  tickets={account}
                  onRemove={
                    account.length === 1
                      ? undefined
                      : (id) => setExtraIds((current) => current.filter((other) => other !== id))
                  }
                  onAdd={() => setPicking(true)}
                  onAddProducts={withProducts ? undefined : () => setWithProducts(true)}
                />

                {withProducts ? (
                  <Card className="gap-3 px-card">
                    <CardSectionHeading
                      aside={
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => {
                            products.reset();
                            setWithProducts(false);
                          }}
                        >
                          Quitar productos
                        </Button>
                      }
                    >
                      Productos sueltos
                    </CardSectionHeading>
                    <p className="text-text-faint text-dense">
                      Salen del inventario al cobrar y se guardan como una venta en esta misma
                      cuenta. No generan comisión.
                    </p>
                    <AccountProductSearch products={products} />
                    <AccountProductLines
                      products={products}
                      emptyHint="Usá el + de un producto para sumarlo a la cuenta."
                    />
                  </Card>
                ) : null}

                {/* Responsable y nota son de **un** lavado: con varios lavados
                  no hay a cuál pegarlos, así que solo salen con uno solo. */}
                {account.length === 1 ? (
                  <>
                    <div>
                      <p className="text-text-faint text-label mb-2">Responsable legal</p>
                      {existing ? (
                        <p className="text-text text-body">
                          {existing.fullName}
                          {existing.phone ? ` · ${existing.phone}` : ''}
                        </p>
                      ) : (
                        <>
                          <p className="text-text-dim text-dense mb-3">
                            Este carro no tiene responsable. Se anota ahora o nunca: el cobro no
                            espera.
                          </p>
                          <OwnerField
                            value={customer}
                            onChange={setCustomer}
                            scope="carwash-charge"
                            searchCustomers={(query) => listCustomers({ q: query })}
                            matchCustomer={matchCustomer}
                            label="Nombre y teléfono"
                            idPrefix="charge-responsible"
                          />
                          {link.error ? (
                            <p className="text-danger-text text-dense mt-2" role="alert">
                              {link.error.message}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <TicketNoteField
                      id="charge-ticket-notes"
                      value={note.value}
                      original={ticket.notes}
                      saving={updateNotes.isPending}
                      error={updateNotes.error?.message ?? null}
                      help="No bloquea el cobro."
                      conflict={note.conflict}
                      onChange={note.setValue}
                      onAcceptConflict={note.accept}
                      onSave={() =>
                        updateNotes.mutate(note.value.trim(), {
                          onSuccess: () => toast({ title: 'Nota guardada' }),
                        })
                      }
                    />
                  </>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <p className="text-text-faint text-label">
                    {split ? 'Pago partido' : 'Método de pago'}
                  </p>
                  {split ? (
                    <SplitPaymentLines
                      lines={lines}
                      totalCents={totalCents}
                      onChange={setLines}
                      onSingle={() => {
                        setSplit(false);
                        setLines([]);
                      }}
                    />
                  ) : (
                    <>
                      <MethodPicker value={method} onValueChange={setMethod} />
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="self-start"
                        onClick={() => {
                          // Partir es quitarle a un renglón que ya tiene el
                          // total, no empezar de cero.
                          setSplit(true);
                          setLines([{ id: 'line-1', method, amount: formatMoney(totalCents) }]);
                        }}
                      >
                        Partir el pago en varios métodos
                      </Button>
                    </>
                  )}
                </div>

                {cashDue > 0 ? (
                  <CashBox
                    cashDue={cashDue}
                    tendered={tendered}
                    change={change}
                    short={short}
                    onChange={setTendered}
                  />
                ) : null}

                <SpreadDetails
                  tickets={buckets}
                  totalCents={totalCents}
                  labelOf={(id) => {
                    const row = account.find((other) => other.id === id);

                    return row === undefined
                      ? ''
                      : `#${referenceOf(row.number)} · ${row.vehicle.plate}`;
                  }}
                />
              </div>
            </div>
          )}

          {charge.error && !apiBlocked ? (
            <p className="text-danger-text text-body" role="alert">
              {charge.error.message}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0">
            <span className="text-text-faint text-label">
              {single ? 'Total' : `Total · ${accountLabel(account.length, hasProducts)}`}
            </span>
            <span className="text-figure text-text tabular-nums">${formatMoney(totalCents)}</span>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancelar
            </Button>
            {blocked ? null : (
              <Button
                type="button"
                disabled={chosen === undefined || waitingCash || blocker !== null}
                loading={charge.isPending || waitingCash || updateNotes.isPending || link.isPending}
                onClick={submit}
              >
                {blocker ??
                  (split ? `Cobrar ${lines.length} pagos` : (chosen?.verb ?? 'Elegí un método'))}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      <ChargeTicketPicker
        open={picking}
        onOpenChange={setPicking}
        excludedIds={account.map((row) => row.id)}
        onAdd={(ids) => setExtraIds((current) => [...current, ...ids])}
      />
    </Dialog>
  );
}

/** «2 lavados», «1 lavado y productos». */
function accountLabel(washes: number, withProducts: boolean): string {
  const count = washes === 1 ? '1 lavado' : `${washes} lavados`;

  return withProducts ? `${count} y productos` : count;
}

/** El toast del cobro: el lavado, los lavados o la cuenta con su venta (066). */
function chargedTitle(reference: number, washes: number, saleNumber: string | null): string {
  if (saleNumber !== null) return `Cuenta cobrada · venta ${saleNumber}`;

  return washes === 1 ? `Lavado #${reference} cobrado` : `${washes} lavados cobrados`;
}
