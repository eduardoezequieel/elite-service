'use client';

import { API_ERROR_CODES, PERMISSIONS } from '@elite/shared';
import type { PaymentMethod, Ticket } from '@elite/shared';
import { Plus, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useActiveBankAccounts } from '@/features/banking/hooks/use-bank-accounts';
import {
  accountBuckets,
  accountTotalCents,
  cashDueCents,
  changeCents,
  fitLastLine,
  isCashShort,
  paidCents,
  type PaymentLine,
} from '@/features/carwash/charge-math';
import { ChargeAccount } from '@/features/carwash/components/charge-account';
import {
  CashBox,
  METHODS,
  MethodPicker,
  PaymentDetailsFields,
  SplitPaymentLines,
  SpreadDetails,
} from '@/features/carwash/components/charge-payment';
import { ChargeTicketPicker } from '@/features/carwash/components/charge-ticket-picker';
import { useCurrentCashSession } from '@/features/carwash/hooks/use-cash';
import { useCreateCharge, useTickets } from '@/features/carwash/hooks/use-tickets';
import {
  chargeErrorMessage,
  transferUnavailableReason,
  withEffectiveAccount,
  type PaymentDetailsDraft,
} from '@/features/carwash/payment-details';
import { formatMoney, toCents } from '@/features/carwash/pricing';
import { referenceOf } from '@/features/carwash/reference';
import { useAccountProducts } from '../hooks/use-account-products';
import { buildChargeInput, insufficientStockOf, saleBlocker } from '../sale-cart';
import { AccountProductLines, AccountProductSearch } from './account-products';
import { SaleSummary } from './sale-summary';

/**
 * `/sales/new`: vender productos sin lavado (065 RN-18 a RN-21), y si el
 * cliente además se lleva un carro listo, cobrarlo en la misma cuenta (066).
 *
 * Arriba el buscador con el `− +` de cada producto, en el medio lo que se
 * lleva —`2 × $3.00 = $6.00`, con su candado de precio—, los lavados listos
 * que se sumen con «Sumar un lavado listo», y abajo el mismo pago de la 059: un
 * método o partido, con cuánto paga y el cambio. Nada se guarda hasta cobrar:
 * la venta nace cobrada, y si una línea no alcanza falla entera y esa línea
 * dice cuánto hay.
 *
 * Se cobra con `POST /carwash/charges`, la misma cuenta del lavado, haya o no
 * lavados sumados: un solo cuerpo y una sola mutación para las dos pantallas.
 *
 * Sin turno abierto la pantalla lo dice y no deja cobrar. El turno solo se
 * puede consultar con `carwash.cash`; sin ese permiso se entera por el
 * `409 CASH_NOT_OPEN` del API, igual que el cobro del lavado.
 */
export function NewSaleScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCash = can(PERMISSIONS.carwash.actions.cash.key);
  const current = useCurrentCashSession(canCash);
  const create = useCreateCharge();
  const resetCreate = create.reset;
  const apiSaysClosed = create.error?.code === API_ERROR_CODES.CASH_NOT_OPEN;
  const staleError = create.error !== null && !apiSaysClosed;

  const products = useAccountProducts({
    // Cambiar la venta después de un error viejo lo deja atrás.
    onEdit: useCallback(() => {
      if (staleError) resetCreate();
    }, [staleError, resetCreate]),
  });
  const [customerName, setCustomerName] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [details, setDetails] = useState<PaymentDetailsDraft>({});
  const [split, setSplit] = useState(false);
  const [rawPayments, setPayments] = useState<PaymentLine[]>([]);
  // Las cuentas a las que puede entrar una transferencia (069).
  const bankAccounts = useActiveBankAccounts();
  const accounts = bankAccounts.data ?? [];
  const accountIds = accounts.map((account) => account.id);
  const transferOff = transferUnavailableReason({
    isPending: bankAccounts.isPending,
    isError: bankAccounts.isError,
    count: accounts.length,
  });
  const disabledMethods = transferOff === null ? {} : { TRANSFER: transferOff };
  const payments = rawPayments.map((line) => withEffectiveAccount(line, accountIds));
  const singleDetails = withEffectiveAccount({ ...details, method }, accountIds);
  const [tendered, setTendered] = useState('');
  const [ticketIds, setTicketIds] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState(false);

  // Los lavados sumados se releen de la consulta, nunca de una copia guardada:
  // si otra caja cobró uno mientras se armaba la venta, sale solo (059).
  const ready = useTickets({ status: 'READY' }, ticketIds.length > 0);
  const washes = ticketIds
    .map((id) => (ready.data ?? []).find((row) => row.id === id))
    .filter((row): row is Ticket => row !== undefined && row.payments.length === 0);
  const ticketsCents = accountTotalCents(washes);
  const buckets = accountBuckets(washes, products.lines.length > 0 ? products.totalCents : null);

  const totalCents = ticketsCents + products.totalCents;
  const cashDue = cashDueCents({ totalCents, split, lines: payments, method });
  const change = changeCents(tendered, cashDue);
  const short = isCashShort(tendered, cashDue);
  const cashKnownClosed =
    canCash && !current.isPending && current.error === null && current.data === null;
  const cashClosed = cashKnownClosed || apiSaysClosed;
  const waitingCash = canCash && current.isPending;
  const blocker = saleBlocker({
    cashClosed,
    lines: products.lines,
    priceAuthorization: products.priceAuthorization,
    split,
    payments,
    tendered,
    cashDue,
    ticketsCents,
    method,
    details: singleDetails,
    bankAccountIds: accountIds,
  });
  const chosen = METHODS.find((option) => option.value === method);
  const verb = split ? `Cobrar ${payments.length} pagos` : (chosen?.verb ?? 'Cobrar');
  const showCash = cashDue > 0 && tendered.trim() !== '' && toCents(tendered) > 0;
  const errorMessage =
    create.error === null || apiSaysClosed
      ? null
      : insufficientStockOf(create.error.code, create.error.details) !== null
        ? 'No alcanzó la existencia de un producto: bajá la cantidad y volvé a cobrar. No se cobró nada.'
        : chargeErrorMessage(create.error);

  // Si el total cambia —se sumó un producto o un lavado, se autorizó un
  // precio— la diferencia cae en el último renglón del pago partido (059).
  useEffect(() => {
    setPayments((previous) =>
      previous.length === 0 ? previous : fitLastLine(previous, totalCents),
    );
  }, [totalCents]);

  // Se abrió el turno en otra pestaña: el 409 de antes ya no manda.
  const cashOpen = canCash && current.data !== null && current.data !== undefined;

  useEffect(() => {
    if (cashOpen && apiSaysClosed) resetCreate();
  }, [cashOpen, apiSaysClosed, resetCreate]);

  function submit(): void {
    if (blocker !== null || create.isPending) return;

    create.mutate(
      buildChargeInput({
        workOrderIds: washes.map((row) => row.id),
        lines: products.lines,
        customerName,
        split,
        method,
        details: singleDetails,
        payments,
        tendered,
        cashDue,
        totalCents,
        priceAuthorization: products.priceAuthorization,
      }),
      {
        onSuccess: (charge) => {
          const sale = charge.counterSale;

          toast({
            title:
              sale === null
                ? `Cuenta ${charge.number} cobrada`
                : washes.length === 0
                  ? `Venta ${sale.number} cobrada`
                  : `Venta ${sale.number} cobrada con ${washes.length === 1 ? 'un lavado' : `${washes.length} lavados`}`,
            description:
              change > 0 ? `$${charge.total} · cambio $${formatMoney(change)}` : `$${charge.total}`,
          });
          router.push(sale === null ? '/sales' : `/sales/${sale.id}`);
        },
        onError: products.absorbError,
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title="Nueva venta"
        subtitle="Productos sin lavado, y si hace falta un lavado listo en la misma cuenta. No se guarda nada hasta cobrar."
      />

      {cashClosed ? (
        <div
          role="alert"
          className="tint text-danger-text flex flex-wrap items-start gap-2.5 rounded-row border px-3.5 py-3"
        >
          <TriangleAlert aria-hidden strokeWidth={1.5} className="size-icon mt-0.5 shrink-0" />
          <p className="text-body min-w-0 flex-1">
            <b className="font-semibold">Sin turno abierto.</b> Abrí el turno de caja para poder
            cobrar. Podés armar la venta, pero no se cobra.
          </p>
          {canCash ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/carwash/cash">Ir a la caja</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {canCash && current.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {current.error.message}
        </p>
      ) : null}

      <div className="grid items-start gap-6 pb-[calc(var(--control-h)+3.5rem+env(safe-area-inset-bottom))] xl:grid-cols-[minmax(0,1fr)_340px] xl:pb-0">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-3 px-card">
            <CardSectionHeading aside="salen del inventario al cobrar">
              Productos
            </CardSectionHeading>
            <AccountProductSearch products={products} />
          </Card>

          <Card className="gap-3 px-card">
            <CardSectionHeading
              aside={
                products.lines.length === 0
                  ? 'vacía'
                  : `${products.lines.length} ${products.lines.length === 1 ? 'producto' : 'productos'}`
              }
            >
              En la venta
            </CardSectionHeading>

            <AccountProductLines products={products} />

            <FieldBox>
              <Label htmlFor="sale-customer">Cliente (opcional)</Label>
              <Input
                id="sale-customer"
                value={customerName}
                maxLength={120}
                autoComplete="off"
                placeholder="Nombre libre, sin carro"
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </FieldBox>
          </Card>

          <Card className="gap-3 px-card">
            <CardSectionHeading
              aside={
                washes.length === 0
                  ? 'opcional'
                  : `${washes.length} ${washes.length === 1 ? 'lavado' : 'lavados'} · $${formatMoney(ticketsCents)}`
              }
            >
              Lavados en la cuenta
            </CardSectionHeading>

            {washes.length === 0 ? (
              <>
                <p className="text-text-faint text-dense">
                  Si el cliente también se lleva un carro listo, se cobra junto: un solo pago y un
                  solo vuelto.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto sm:self-start"
                  onClick={() => setPicking(true)}
                >
                  <Plus aria-hidden strokeWidth={1.5} />
                  Sumar un lavado listo
                </Button>
              </>
            ) : (
              <ChargeAccount
                tickets={washes}
                onRemove={(id) =>
                  setTicketIds((previous) => previous.filter((other) => other !== id))
                }
                onAdd={() => setPicking(true)}
              />
            )}
          </Card>

          <Card className="gap-3 px-card">
            <CardSectionHeading
              aside={split ? 'deben sumar el total' : `$${formatMoney(totalCents)}`}
            >
              {split ? 'Pago partido' : 'Pago'}
            </CardSectionHeading>

            {split ? (
              <SplitPaymentLines
                lines={payments}
                totalCents={totalCents}
                onChange={setPayments}
                accounts={accounts}
                disabled={disabledMethods}
                onSingle={() => {
                  setSplit(false);
                  setPayments([]);
                }}
              />
            ) : (
              <>
                <MethodPicker value={method} onValueChange={setMethod} disabled={disabledMethods} />
                <PaymentDetailsFields
                  idPrefix="sale-payment"
                  method={method}
                  details={singleDetails}
                  accounts={accounts}
                  onChange={setDetails}
                />
                {totalCents > 0 ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      // Partir es quitarle a un renglón que ya tiene el total.
                      setSplit(true);
                      setPayments([
                        { ...singleDetails, id: 'line-1', amount: formatMoney(totalCents) },
                      ]);
                    }}
                  >
                    Partir el pago en varios métodos
                  </Button>
                ) : null}
              </>
            )}

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
                const row = washes.find((other) => other.id === id);

                return row === undefined
                  ? ''
                  : `#${referenceOf(row.number)} · ${row.vehicle.plate}`;
              }}
            />
          </Card>

          {/* Bajo 1180px el resumen es la barra del pie y no tiene dónde decir
              el error: va acá, al final de lo que se estaba llenando. */}
          {errorMessage === null ? null : (
            <p className="text-danger-text text-body xl:hidden" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <SaleSummary
          lines={products.lines}
          washes={washes.map((row) => ({
            id: row.id,
            label: `Lavado #${referenceOf(row.number)} · ${row.vehicle.plate}`,
            total: row.total,
          }))}
          totalCents={totalCents}
          split={split}
          paidCents={paidCents(payments)}
          showCash={showCash}
          tenderedCents={toCents(tendered)}
          changeCents={change}
          cashShort={short}
          blocker={waitingCash ? 'Revisando la caja…' : blocker}
          verb={verb}
          isSubmitting={create.isPending}
          onSubmit={submit}
          note={
            cashClosed
              ? 'No hay turno abierto: no se puede cobrar.'
              : 'Entra al turno de caja abierto. Al cobrar abre el detalle de la venta.'
          }
          errorMessage={errorMessage}
        />
      </div>

      <ChargeTicketPicker
        open={picking}
        onOpenChange={setPicking}
        excludedIds={washes.map((row) => row.id)}
        onAdd={(ids) => setTicketIds((previous) => [...previous, ...ids])}
      />
    </div>
  );
}
