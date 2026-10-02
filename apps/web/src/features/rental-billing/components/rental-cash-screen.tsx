'use client';

import { PAYMENT_METHOD_LABELS, RENTAL_PAYMENT_METHOD_ORDER } from '@elite/shared';
import type {
  DepositHeldRow,
  Page,
  PaymentMethod,
  ReceivableRow,
  RentalCashPayment,
  RentalCashReport,
} from '@elite/shared';
import {
  ArrowLeftRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Printer,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DateField } from '@/components/ui/date-field';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { addDays, dayLabel, timeLabel, todayCivil } from '@/lib/civil-date';
import { formatMoney, moneyParts } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { useDepositsHeld, useReceivables, useRentalCash } from '../hooks/use-rental-billing';
import { FineDialog } from './fine-dialog';
import { PaymentAmount } from './payment-amount';
import { RentalPaymentStamp } from './payment-method-stamp';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  OTHER: Wallet,
};

/** Adónde lleva una fila: el detalle de la renta (096). */
const agreementHref = (row: { agreementId: string }) => `/rentals/agreements/${row.agreementId}`;

function contractText(contractNumber: number | null): string {
  return contractNumber === null ? 'Sin contrato' : `#${contractNumber}`;
}

/**
 * La «Caja» de la rentadora (098): el reporte de un día, no un turno. Qué
 * entró, por qué medio y por quién; qué se anuló; qué depósitos se guardan y
 * qué se debe. «Imprimir cierre» es esta misma pantalla con los estilos de
 * impresión (RN-5): no hay foto guardada.
 */
export function RentalCashScreen({
  initialPaymentsPage = 1,
  initialDepositsPage = 1,
  initialReceivablesPage = 1,
}: {
  initialPaymentsPage?: number;
  initialDepositsPage?: number;
  initialReceivablesPage?: number;
}) {
  const today = todayCivil();
  const [date, setDate] = useState(today);
  const [finesOpen, setFinesOpen] = useState(false);
  // Tres listas paginadas en servidor (101), cada una con su página en la URL.
  const [paymentsPage, setPaymentsPage] = useUrlPage('paymentsPage', initialPaymentsPage, date);
  const [depositsPage, setDepositsPage] = useUrlPage('depositsPage', initialDepositsPage);
  const [receivablesPage, setReceivablesPage] = useUrlPage(
    'receivablesPage',
    initialReceivablesPage,
  );
  const cash = useRentalCash(date, paymentsPage);
  const deposits = useDepositsHeld(depositsPage);
  const receivables = useReceivables(receivablesPage);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Caja" subtitle={`Renta de carros · ${dayLabel(date, { year: true })}`}>
        <Button type="button" variant="secondary" onClick={() => setFinesOpen(true)}>
          Registrar multa
        </Button>
        <Button type="button" onClick={() => window.print()} disabled={cash.data === undefined}>
          <Printer strokeWidth={1.5} />
          Imprimir cierre
        </Button>
      </ScreenHeader>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Día anterior"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft strokeWidth={1.5} />
        </Button>
        <DateField value={date} onChange={setDate} aria-label="Día de la caja" />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Día siguiente"
          disabled={date >= today}
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight strokeWidth={1.5} />
        </Button>
      </div>

      {cash.isPending ? (
        <DetailSkeleton label="Cargando la caja" />
      ) : cash.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {cash.error.message}
        </p>
      ) : (
        <CashReport report={cash.data} onPaymentsPage={setPaymentsPage} />
      )}

      <Section
        title="Depósitos en custodia"
        aside={totalLabel(deposits.data?.totalAmount, deposits.data?.total)}
      >
        <DepositsTable
          page={deposits.data}
          isLoading={deposits.isPending}
          errorMessage={deposits.error?.message ?? null}
        />
        <Pager
          page={deposits.data}
          noun={{ one: 'depósito', many: 'depósitos' }}
          onPageChange={setDepositsPage}
        />
      </Section>

      <Section
        title="Cuentas por cobrar"
        aside={totalLabel(receivables.data?.totalBalance, receivables.data?.total)}
      >
        <ReceivablesTable
          page={receivables.data}
          isLoading={receivables.isPending}
          errorMessage={receivables.error?.message ?? null}
        />
        <Pager
          page={receivables.data}
          noun={{ one: 'cuenta', many: 'cuentas' }}
          onPageChange={setReceivablesPage}
        />
      </Section>

      {finesOpen ? <FineDialog onClose={() => setFinesOpen(false)} /> : null}
    </div>
  );
}

function CashReport({
  report,
  onPaymentsPage,
}: {
  report: RentalCashReport;
  onPaymentsPage: (page: number) => void;
}) {
  const total = moneyParts(report.total);

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5 print:grid-cols-5">
        <StatCard
          label="Cobrado"
          value={total.whole}
          unit={total.fraction}
          tone="go"
          detail={`${report.payments.total} ${report.payments.total === 1 ? 'pago' : 'pagos'}`}
        />
        {RENTAL_PAYMENT_METHOD_ORDER.map((method) => {
          const Icon = METHOD_ICONS[method];
          const amount = moneyParts(report.byMethod[method]);

          return (
            <StatCard
              key={method}
              label={PAYMENT_METHOD_LABELS[method]}
              value={amount.whole}
              unit={amount.fraction}
              icon={<Icon strokeWidth={1.5} />}
              detail={method === 'CASH' ? 'Lo que debe haber en caja' : undefined}
            />
          );
        })}
      </div>

      <Section title="Cobros del día">
        <PaymentsTable
          rows={report.payments.items}
          reference={(_, index) => pagedReference(report.payments, index)}
          emptyTitle="Sin cobros este día"
          emptyMessage="Cuando se registre un pago de renta en este día, aparece acá."
        />
        <Pager
          page={report.payments}
          noun={{ one: 'pago', many: 'pagos' }}
          onPageChange={onPaymentsPage}
        />
      </Section>

      {report.voided.length === 0 ? null : (
        <Section title="Anulados">
          <PaymentsTable rows={report.voided} emptyMessage="" />
        </Section>
      )}

      <Section title="Por usuario">
        <DataTable
          rows={report.byUser}
          rowKey={(row) => row.userId}
          emptyMessage="Nadie cobró este día."
          columns={[
            {
              key: 'name',
              header: 'Usuario',
              stack: 'title',
              cell: (row) => <span className="text-text">{row.name}</span>,
            },
            {
              key: 'total',
              header: 'Cobró',
              align: 'right',
              cell: (row) => (
                <span className="font-mono tabular-nums">{formatMoney(row.total)}</span>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}

/** «$180.00 en total», sumado en centavos. */
/** «$180.00 en total», de todas las filas: lo suma el API (101). */
function totalLabel(amount: string | undefined, count: number | undefined): string | undefined {
  if (amount === undefined || count === undefined || count === 0) return undefined;

  return `${formatMoney(amount)} en total`;
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title text-text">{title}</h2>
        {aside === undefined ? null : (
          <p className="text-text-dim text-dense tabular-nums">{aside}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function PaymentsTable({
  rows,
  reference,
  emptyTitle,
  emptyMessage,
}: {
  rows: RentalCashPayment[];
  reference?: (row: RentalCashPayment, index: number) => number;
  emptyTitle?: string;
  emptyMessage: string;
}) {
  return (
    <DataTable
      rows={rows}
      reference={reference}
      rowKey={(row) => row.id}
      rowHref={agreementHref}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      columns={[
        {
          key: 'customer',
          header: 'Cliente',
          stack: 'title',
          cell: (row) => <span className="text-text">{row.customerName}</span>,
        },
        {
          key: 'time',
          header: 'Hora',
          cell: (row) => (
            <span className="text-text-dim tabular-nums">{timeLabel(row.paidAt)}</span>
          ),
        },
        {
          key: 'contract',
          header: 'Contrato',
          cell: (row) => (
            <span className="text-text-dim font-mono">{contractText(row.contractNumber)}</span>
          ),
        },
        {
          key: 'reference',
          header: 'Referencia',
          cell: (row) => <span className="text-text-dim font-mono">{row.reference ?? '—'}</span>,
        },
        {
          key: 'receivedBy',
          header: 'Recibió',
          cell: (row) => <span className="text-text-dim">{row.receivedByName}</span>,
        },
        {
          key: 'amount',
          header: 'Monto',
          align: 'right',
          className: 'whitespace-normal',
          cell: (row) => <PaymentAmount payment={row} />,
        },
        {
          key: 'method',
          header: 'Forma de pago',
          stack: 'aside',
          cell: (row) => <RentalPaymentStamp method={row.method} voided={row.voidedAt !== null} />,
        },
      ]}
    />
  );
}

function DepositsTable({
  page,
  isLoading,
  errorMessage,
}: {
  page: Page<DepositHeldRow> | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <DataTable
      rows={page?.items ?? []}
      reference={(_, index) => pagedReference(page, index)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      rowKey={(row) => row.agreementId}
      rowHref={agreementHref}
      emptyTitle="Ningún depósito en custodia"
      emptyMessage="Los depósitos que se guardan y todavía no se devuelven aparecen acá."
      columns={[
        {
          key: 'customer',
          header: 'Cliente',
          stack: 'title',
          cell: (row) => <span className="text-text">{row.customer}</span>,
        },
        {
          key: 'contract',
          header: 'Contrato',
          cell: (row) => (
            <span className="text-text-dim font-mono">{contractText(row.contractNumber)}</span>
          ),
        },
        {
          key: 'amount',
          header: 'Depósito',
          align: 'right',
          cell: (row) => <span className="font-mono tabular-nums">{formatMoney(row.amount)}</span>,
        },
      ]}
    />
  );
}

function ReceivablesTable({
  page,
  isLoading,
  errorMessage,
}: {
  page: Page<ReceivableRow> | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <DataTable
      rows={page?.items ?? []}
      reference={(_, index) => pagedReference(page, index)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      rowKey={(row) => row.agreementId}
      rowHref={agreementHref}
      emptyTitle="Nadie debe"
      emptyMessage="Las rentas en curso o finalizadas con saldo pendiente aparecen acá."
      columns={[
        {
          key: 'customer',
          header: 'Cliente',
          stack: 'title',
          cell: (row) => <span className="text-text">{row.customer}</span>,
        },
        {
          key: 'contract',
          header: 'Contrato',
          cell: (row) => (
            <span className="text-text-dim font-mono">{contractText(row.contractNumber)}</span>
          ),
        },
        {
          key: 'total',
          header: 'Total',
          align: 'right',
          cell: (row) => <span className="font-mono tabular-nums">{formatMoney(row.total)}</span>,
        },
        {
          key: 'paid',
          header: 'Pagado',
          align: 'right',
          cell: (row) => <span className="font-mono tabular-nums">{formatMoney(row.paid)}</span>,
        },
        {
          key: 'balance',
          header: 'Saldo',
          align: 'right',
          cell: (row) => (
            <span className="text-text font-mono font-semibold tabular-nums">
              {formatMoney(row.balance)}
            </span>
          ),
        },
        {
          key: 'status',
          header: 'Estado',
          stack: 'aside',
          cell: (row) =>
            row.status === 'IN_PROGRESS' ? (
              <Stamp label="En curso" tone="amber" />
            ) : (
              <Stamp label="Finalizada" tone="neutral" />
            ),
        },
      ]}
    />
  );
}
