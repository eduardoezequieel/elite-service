'use client';

import {
  API_ERROR_CODES,
  MAX_PAGE_SIZE,
  PERMISSIONS,
  createCounterSaleSchema,
  paymentMethodSchema,
} from '@elite/shared';
import type { TabHolderOption, Ticket } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldBox } from '@/components/ui/field-box';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
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
import { referenceOf } from '@/features/carwash/reference';
import { HolderCombobox } from '@/features/tabs/components/holder-combobox';
import {
  useAddTabLines,
  usePrimedHolder,
  useTab,
  useTabHolders,
} from '@/features/tabs/hooks/use-tabs';
import {
  addTabLinesInput,
  firstName,
  holdersInOrder,
  newSaleTargetFrom,
  owedAfterCents,
  tabLinesBlocker,
  tabsListHref,
} from '@/features/tabs/tab-format';
import { centsToAmount, formatCents } from '@/lib/money';
import { useAccountProducts } from '../hooks/use-account-products';
import { buildChargeInput, insufficientStockOf, saleBlocker } from '../sale-cart';
import { SaleModeSwitch, type SaleMode } from './sale-mode-switch';
import { SaleProductList } from './sale-product-list';
import { SaleSummary } from './sale-summary';

/**
 * Lo que se teclea y se elige para cobrar. El nombre libre sale de
 * `createCounterSaleSchema` y el método de `paymentMethodSchema`, de
 * `@elite/shared`; el resto del pago lo valida la aritmética de la 059
 * (`saleBlocker`), que es la misma regla que aplica el API.
 */
const saleFormSchema = z.object({
  customerName: createCounterSaleSchema.shape.customerName.unwrap(),
  method: paymentMethodSchema,
  details: z.custom<PaymentDetailsDraft>(),
  split: z.boolean(),
  payments: z.custom<PaymentLine[]>(),
  /** Lo que entrega el cliente, tal cual está en el campo. Vacío es «no se anotó». */
  tendered: z.string(),
});

type SaleFormInput = z.input<typeof saleFormSchema>;
type SaleFormOutput = z.output<typeof saleFormSchema>;

const EMPTY_SALE_FORM: SaleFormInput = {
  customerName: '',
  method: 'CASH',
  details: {},
  split: false,
  payments: [],
  tendered: '',
};

/** El faltante de existencia, dicho corto: la línea ya marca cuánto hay. */
const STOCK_ERROR = 'No alcanzó la existencia de un producto.';

/**
 * `/sales/new`: vender productos sin lavado (065), o anotarlos a la cuenta de
 * alguien (106).
 *
 * A la izquierda los productos como lista de filas (buscador, chips de
 * categoría, `+` que se vuelve `− N +`) y, al cobrar ahora, «Sumar un lavado
 * listo» (066). A la derecha el resumen de solo lectura, el total y el
 * selector «Cobrar ahora | Anotar a cuenta»:
 *
 * - **Cobrar ahora**: el mismo pago de la 059 (un método o partido, cuánto paga
 *   y el cambio) por `POST /carwash/charges`. Nada se guarda hasta cobrar, y
 *   sin turno abierto no se cobra.
 * - **Anotar a cuenta**: el flotante «¿A quién se le anota?», «Queda debiendo»
 *   y `POST /tabs/lines`, al precio del artículo y sin lavados. Vuelve a Cuentas
 *   abiertas con la cuenta resaltada. No pide turno: la plata entra al abonar.
 *
 * Con `?tab=` («Anotar productos» del detalle) el titular viene fijo, no hay
 * selector y al terminar vuelve a esa cuenta. Con `?holderKind=&holderId=`
 * («Abrir y anotar») arranca en «Anotar a cuenta» con la persona puesta.
 */
export function NewSaleScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = useMemo(() => newSaleTargetFrom(searchParams), [searchParams]);
  const { toast } = useToast();
  const { can } = usePermissions();
  const canCash = can(PERMISSIONS.carwash.actions.cash.key);
  const current = useCurrentCashSession(canCash);
  const create = useCreateCharge();
  const addLines = useAddTabLines();
  const resetCreate = create.reset;
  const resetAddLines = addLines.reset;
  const apiSaysClosed = create.error?.code === API_ERROR_CODES.CASH_NOT_OPEN;
  const staleError = (create.error !== null && !apiSaysClosed) || addLines.error !== null;

  // --- A quién (106) ---
  const fixedTab = useTab(target.kind === 'tab' ? target.tabId : null);
  const fixed = target.kind === 'tab';
  const presetRef = target.kind === 'holder' ? target.holder : null;
  const primed = usePrimedHolder(presetRef?.kind ?? null, presetRef?.id ?? null);
  // Tras recargar no hay persona guardada: se busca en la lista sin filtro.
  const presetLookup = useTabHolders('', presetRef !== null && primed === null);
  const preset =
    primed ??
    (presetRef === null
      ? null
      : (holdersInOrder(presetLookup.data).find(
          (option) => option.kind === presetRef.kind && option.id === presetRef.id,
        ) ?? null));
  const [picked, setPicked] = useState<TabHolderOption | null | undefined>(undefined);
  const holder = picked === undefined ? preset : picked;
  const [mode, setMode] = useState<SaleMode>(target.kind === 'sale' ? 'NOW' : 'TAB');

  const products = useAccountProducts({
    // Cambiar la venta después de un error viejo lo deja atrás.
    onEdit: useCallback(() => {
      if (!staleError) return;
      resetCreate();
      resetAddLines();
    }, [staleError, resetCreate, resetAddLines]),
  });
  const form = useForm<SaleFormInput, unknown, SaleFormOutput>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: EMPTY_SALE_FORM,
  });
  const { method, details, split, payments: rawPayments, tendered } = form.watch();
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
  const [ticketIds, setTicketIds] = useState<readonly string[]>([]);
  const [picking, setPicking] = useState(false);

  // Los lavados sumados se releen de la consulta, nunca de una copia guardada:
  // si otra caja cobró uno mientras se armaba la venta, sale solo (059).
  const ready = useTickets({ status: 'READY', pageSize: MAX_PAGE_SIZE }, ticketIds.length > 0);
  const washes = ticketIds
    .map((id) => (ready.data?.items ?? []).find((row) => row.id === id))
    .filter((row): row is Ticket => row !== undefined && row.payments.length === 0);
  const ticketsCents = mode === 'NOW' ? accountTotalCents(washes) : 0;
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
  const chargeError =
    create.error === null || apiSaysClosed
      ? null
      : insufficientStockOf(create.error.code, create.error.details) !== null
        ? STOCK_ERROR
        : chargeErrorMessage(create.error);

  // --- Anotar (106) ---
  const tabHolder = fixed
    ? fixedTab.data === undefined
      ? null
      : { kind: fixedTab.data.holder.kind, id: fixedTab.data.holder.id }
    : holder === null
      ? null
      : { kind: holder.kind, id: holder.id };
  const tabHolderName = fixed
    ? (fixedTab.data?.holder.fullName ?? null)
    : (holder?.fullName ?? null);
  const openTab = fixed
    ? fixedTab.data?.status === 'OPEN'
      ? fixedTab.data
      : null
    : (holder?.openTab ?? null);
  const tabBlocker = tabLinesBlocker({ lines: products.lines, hasHolder: tabHolder !== null });
  const tabError =
    addLines.error === null
      ? null
      : insufficientStockOf(addLines.error.code, addLines.error.details) !== null
        ? STOCK_ERROR
        : addLines.error.message;

  // Si el total cambia —se sumó un producto o un lavado, se autorizó un
  // precio— la diferencia cae en el último renglón del pago partido (059).
  useEffect(() => {
    const previous = form.getValues('payments');

    if (previous.length > 0) form.setValue('payments', fitLastLine(previous, totalCents));
  }, [totalCents, form]);

  // Se abrió el turno en otra pestaña: el 409 de antes ya no manda.
  const cashOpen = canCash && current.data !== null && current.data !== undefined;

  useEffect(() => {
    if (cashOpen && apiSaysClosed) resetCreate();
  }, [cashOpen, apiSaysClosed, resetCreate]);

  function changeMode(next: SaleMode): void {
    if (next === mode) return;

    // A una cuenta se anota al precio del artículo y sin lavados (RN-4).
    if (next === 'TAB') {
      products.edit((previous) =>
        previous.map((line) => ({ ...line, unitPrice: line.catalogPrice })),
      );
      setTicketIds([]);
    }
    resetCreate();
    resetAddLines();
    setMode(next);
  }

  function charge(values: SaleFormOutput): void {
    create.mutate(
      buildChargeInput({
        workOrderIds: washes.map((row) => row.id),
        lines: products.lines,
        customerName: values.customerName,
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
        onSuccess: (result) => {
          const sale = result.counterSale;

          toast({
            title: 'Cobrada',
            description:
              change > 0
                ? `$${result.total} · cambio $${centsToAmount(change)}`
                : `$${result.total}`,
          });
          router.push(sale === null ? '/sales' : `/sales/${sale.id}`);
        },
        onError: products.absorbError,
      },
    );
  }

  function submitCharge(): void {
    if (blocker !== null || create.isPending) return;

    void form.handleSubmit(charge)();
  }

  function submitTab(): void {
    if (tabBlocker !== null || tabHolder === null || addLines.isPending) return;

    addLines.mutate(addTabLinesInput(tabHolder, products.lines), {
      onSuccess: (tab) => {
        toast({ title: `Anotado a ${firstName(tab.holder.fullName)}` });
        router.push(fixed ? `/sales/tabs/${tab.id}` : tabsListHref(tab.id));
      },
      onError: products.absorbError,
    });
  }

  const title = fixed
    ? tabHolderName === null
      ? 'Anotar'
      : `Anotar a ${firstName(tabHolderName)}`
    : 'Nueva venta';
  const back =
    target.kind === 'tab'
      ? { href: `/sales/tabs/${target.tabId}`, label: tabHolderName ?? 'Cuenta' }
      : undefined;

  return (
    <Form {...form}>
      <div className="flex flex-col gap-4">
        <ScreenHeader title={title} back={back} className="mb-2" />

        {mode === 'NOW' && cashClosed ? (
          <div
            role="alert"
            className="tint text-danger-text flex flex-wrap items-center gap-2.5 rounded-row border px-3.5 py-3"
          >
            <TriangleAlert aria-hidden strokeWidth={1.5} className="size-icon shrink-0" />
            <b className="text-body min-w-0 flex-1 font-semibold">Sin turno abierto</b>
            {canCash ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/carwash/cash">Ir a la caja</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        {mode === 'NOW' && canCash && current.error !== null ? (
          <p className="text-danger-text text-body" role="alert">
            {current.error.message}
          </p>
        ) : null}
        {fixed && fixedTab.error !== null ? (
          <p className="text-danger-text text-body" role="alert">
            {fixedTab.error.message}
          </p>
        ) : null}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px] [[data-density=bahia]_&]:xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="flex min-w-0 flex-col gap-4">
            <SaleProductList products={products} canPrice={mode === 'NOW'} />

            {mode === 'NOW' ? (
              washes.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto sm:self-start"
                  onClick={() => setPicking(true)}
                >
                  <Plus aria-hidden strokeWidth={1.5} />
                  Sumar un lavado listo
                </Button>
              ) : (
                <Card className="gap-3 px-card">
                  <ChargeAccount
                    tickets={washes}
                    onRemove={(id) =>
                      setTicketIds((previous) => previous.filter((other) => other !== id))
                    }
                    onAdd={() => setPicking(true)}
                  />
                </Card>
              )
            ) : null}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6">
            <Card className="gap-4 px-card">
              <SaleSummary
                lines={products.lines}
                washes={
                  mode === 'NOW'
                    ? washes.map((row) => ({
                        id: row.id,
                        label: `Lavado #${referenceOf(row.number)} · ${row.vehicle.plate}`,
                        total: row.total,
                      }))
                    : []
                }
                totalCents={totalCents}
              />

              {fixed ? null : <SaleModeSwitch value={mode} onValueChange={changeMode} />}

              {mode === 'NOW' ? (
                <div className="flex flex-col gap-3.5">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox>
                          <Label htmlFor="sale-customer">Cliente (opcional)</Label>
                          <FormControl>
                            <Input
                              {...field}
                              id="sale-customer"
                              maxLength={120}
                              autoComplete="off"
                            />
                          </FormControl>
                        </FieldBox>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {split ? (
                    <SplitPaymentLines
                      lines={payments}
                      totalCents={totalCents}
                      onChange={(next) => form.setValue('payments', next)}
                      accounts={accounts}
                      disabled={disabledMethods}
                      onSingle={() => {
                        form.setValue('split', false);
                        form.setValue('payments', []);
                      }}
                    />
                  ) : (
                    <>
                      <MethodPicker
                        layout="grid"
                        value={method}
                        onValueChange={(next) => form.setValue('method', next)}
                        disabled={disabledMethods}
                      />
                      <PaymentDetailsFields
                        idPrefix="sale-payment"
                        method={method}
                        details={singleDetails}
                        accounts={accounts}
                        onChange={(next) => form.setValue('details', next)}
                      />
                      {totalCents > 0 ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="self-start"
                          onClick={() => {
                            // Partir es quitarle a un renglón que ya tiene el total.
                            form.setValue('split', true);
                            form.setValue('payments', [
                              { ...singleDetails, id: 'line-1', amount: centsToAmount(totalCents) },
                            ]);
                          }}
                        >
                          Partir el pago
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
                      onChange={(next) => form.setValue('tendered', next)}
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

                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    loading={create.isPending}
                    disabled={blocker !== null || waitingCash || create.isPending}
                    onClick={submitCharge}
                  >
                    {waitingCash ? 'Revisando la caja…' : (blocker ?? verb)}
                  </Button>

                  {chargeError === null ? null : (
                    <p className="text-danger-text text-body" role="alert">
                      {chargeError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {fixed ? null : <HolderCombobox value={holder} onChange={setPicked} />}

                  {tabHolder === null ? null : (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-text-dim">Queda debiendo</span>
                      <span className="text-text font-mono font-semibold tabular-nums [[data-density=bahia]_&]:text-title">
                        {formatCents(owedAfterCents(openTab, products.totalCents))}
                      </span>
                    </div>
                  )}

                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    loading={addLines.isPending}
                    disabled={tabBlocker !== null || addLines.isPending}
                    onClick={submitTab}
                  >
                    {tabBlocker ??
                      `Anotar ${formatCents(products.totalCents)} a ${firstName(tabHolderName ?? '')}`}
                  </Button>

                  {tabError === null ? null : (
                    <p className="text-danger-text text-body" role="alert">
                      {tabError}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </aside>
        </div>

        <ChargeTicketPicker
          open={picking}
          onOpenChange={setPicking}
          excludedIds={washes.map((row) => row.id)}
          onAdd={(ids) => setTicketIds((previous) => [...previous, ...ids])}
        />
      </div>
    </Form>
  );
}
