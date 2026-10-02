'use client';

import { PERMISSIONS, moneyToCents } from '@elite/shared';
import type { BillingAgreementView, Page, RentalFine, RentalPayment } from '@elite/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { dayLabel, timeLabel } from '@/lib/civil-date';
import { formatMoney, moneyParts } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { depositStatus, type DepositStatus } from '../billing-format';
import { useAgreementFines, useAgreementPayments } from '../hooks/use-rental-billing';
import { DepositReturnDialog } from './deposit-return-dialog';
import { FineDialog } from './fine-dialog';
import { PaymentAmount } from './payment-amount';
import { RentalPaymentStamp } from './payment-method-stamp';
import { PaymentDialog } from './payment-dialog';
import { VoidPaymentDialog } from './void-payment-dialog';

type OpenDialog =
  | { kind: 'payment' }
  | { kind: 'void'; paymentId: string }
  | { kind: 'deposit' }
  | { kind: 'fine' }
  | null;

/**
 * La cuenta de una renta (098): total, pagado y saldo, el depósito, los pagos
 * y las multas ligadas. La monta el detalle de la renta (096) con su DTO, que
 * cumple `BillingAgreementView`.
 *
 * Con `rentals.charge` trae sus acciones —registrar pago, anular, devolver
 * depósito, agregar multa—; con solo `rentals.read` se lee y nada más. Cada
 * acción invalida el detalle, la lista de rentas y la caja.
 */
export function AgreementBillingPanel({ agreement }: { agreement: BillingAgreementView }) {
  const { can } = usePermissions();
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  // Las tablas leen de a una página del servidor (101); los totales salen del DTO.
  const [paymentsPage, setPaymentsPage] = useUrlPage('paymentsPage', 1, agreement.id);
  const [finesPage, setFinesPage] = useUrlPage('finesPage', 1, agreement.id);
  const payments = useAgreementPayments(agreement.id, paymentsPage);
  const fines = useAgreementFines(agreement.id, finesPage);
  const balanceCents = moneyToCents(agreement.totals.balance);
  const deposit = depositStatus(agreement);
  const takesPayments = agreement.status !== 'CANCELLED' && balanceCents > 0;
  // El pago se relee de la renta en cada render: el diálogo no guarda una copia (051).
  const voiding =
    dialog?.kind === 'void'
      ? (agreement.payments.find((payment) => payment.id === dialog.paymentId) ?? null)
      : null;
  const close = () => setDialog(null);

  return (
    <section aria-labelledby="agreement-billing-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="agreement-billing-title" className="text-title text-text">
          Cuenta
        </h2>
        {canCharge ? (
          <div className="flex flex-wrap gap-2 max-md:w-full max-md:[&>*]:flex-1">
            <Button type="button" variant="secondary" onClick={() => setDialog({ kind: 'fine' })}>
              Agregar multa
            </Button>
            {takesPayments ? (
              <Button type="button" onClick={() => setDialog({ kind: 'payment' })}>
                <Plus strokeWidth={1.5} />
                Registrar pago
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <MoneyStat label="Total" amount={agreement.totals.total} />
        <MoneyStat label="Pagado" amount={agreement.totals.paid} tone="go" />
        <MoneyStat
          label="Saldo"
          amount={agreement.totals.balance}
          detail={
            balanceCents > 0 ? 'Pendiente de cobro' : balanceCents < 0 ? 'Cobrado de más' : 'Al día'
          }
        />
      </div>

      <DepositLine
        status={deposit}
        canReturn={canCharge && deposit.kind === 'held'}
        onReturn={() => setDialog({ kind: 'deposit' })}
      />

      <div className="flex flex-col gap-2.5">
        <h3 className="text-body text-text font-semibold">Pagos</h3>
        <PaymentsTable
          page={payments.data}
          isLoading={payments.isPending}
          errorMessage={payments.error?.message ?? null}
          canVoid={canCharge}
          onVoid={(payment) => setDialog({ kind: 'void', paymentId: payment.id })}
        />
        <Pager
          page={payments.data}
          noun={{ one: 'pago', many: 'pagos' }}
          onPageChange={setPaymentsPage}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-body text-text font-semibold">Multas</h3>
        <FinesTable
          page={fines.data}
          isLoading={fines.isPending}
          errorMessage={fines.error?.message ?? null}
        />
        <Pager
          page={fines.data}
          noun={{ one: 'multa', many: 'multas' }}
          onPageChange={setFinesPage}
        />
      </div>

      {dialog?.kind === 'payment' ? (
        <PaymentDialog
          agreementId={agreement.id}
          balance={agreement.totals.balance}
          onClose={close}
        />
      ) : null}
      {voiding !== null ? <VoidPaymentDialog payment={voiding} onClose={close} /> : null}
      {dialog?.kind === 'deposit' && deposit.kind === 'held' ? (
        <DepositReturnDialog agreementId={agreement.id} deposit={deposit.amount} onClose={close} />
      ) : null}
      {dialog?.kind === 'fine' ? (
        <FineDialog vehicleId={agreement.vehicleId} onClose={close} />
      ) : null}
    </section>
  );
}

function MoneyStat({
  label,
  amount,
  tone = 'default',
  detail,
}: {
  label: string;
  amount: string;
  tone?: 'default' | 'go';
  detail?: string;
}) {
  const parts = moneyParts(amount.replace('-', ''));
  const negative = amount.startsWith('-');

  return (
    <StatCard
      label={label}
      value={`${negative ? '-' : ''}${parts.whole}`}
      unit={parts.fraction}
      tone={tone}
      detail={detail}
    />
  );
}

function DepositLine({
  status,
  canReturn,
  onReturn,
}: {
  status: DepositStatus;
  canReturn: boolean;
  onReturn: () => void;
}) {
  let text: string;

  switch (status.kind) {
    case 'none':
      text = 'Sin depósito.';
      break;
    case 'held':
      text = `Depósito en custodia: ${formatMoney(status.amount)}.`;
      break;
    case 'returned':
      text =
        status.retained === '0.00'
          ? `Depósito devuelto completo: ${formatMoney(status.returned)}.`
          : `Depósito devuelto: ${formatMoney(status.returned)} de ${formatMoney(status.amount)} (se retuvieron ${formatMoney(status.retained)}).`;
      break;
    case 'transferred':
      text = `Depósito de ${formatMoney(status.amount)} pasado a la renta del cambio de carro.`;
      break;
  }

  return (
    <div className="border-line-soft bg-surface flex flex-wrap items-center justify-between gap-3 rounded-row border px-4.5 py-3">
      <p className="text-text text-body">{text}</p>
      {canReturn ? (
        <Button type="button" variant="secondary" className="max-md:w-full" onClick={onReturn}>
          Devolver depósito
        </Button>
      ) : null}
    </div>
  );
}

function PaymentsTable({
  page,
  isLoading,
  errorMessage,
  canVoid,
  onVoid,
}: {
  page: Page<RentalPayment> | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  canVoid: boolean;
  onVoid: (payment: RentalPayment) => void;
}) {
  return (
    <DataTable
      rows={page?.items ?? []}
      reference={(_, index) => pagedReference(page, index)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      rowKey={(payment) => payment.id}
      emptyTitle="Sin pagos todavía"
      emptyMessage={
        canVoid
          ? 'Cuando registres un pago aparece acá, con quién lo recibió.'
          : 'Cuando caja registre un pago aparece acá.'
      }
      columns={[
        {
          key: 'when',
          header: 'Fecha',
          stack: 'title',
          cell: (payment) => (
            <span className="text-text">
              {dayLabel(payment.paidAt)} · {timeLabel(payment.paidAt)}
            </span>
          ),
        },
        {
          key: 'reference',
          header: 'Referencia',
          cell: (payment) => (
            <span className="text-text-dim font-mono">{payment.reference ?? '—'}</span>
          ),
        },
        {
          key: 'receivedBy',
          header: 'Recibió',
          cell: (payment) => <span className="text-text-dim">{payment.receivedByName}</span>,
        },
        {
          key: 'amount',
          header: 'Monto',
          align: 'right',
          className: 'whitespace-normal',
          cell: (payment) => <PaymentAmount payment={payment} />,
        },
        {
          key: 'method',
          header: 'Forma de pago',
          stack: 'aside',
          cell: (payment) => (
            <RentalPaymentStamp method={payment.method} voided={payment.voidedAt !== null} />
          ),
        },
        ...(canVoid
          ? [
              {
                key: 'actions',
                header: 'Acciones',
                stack: 'actions' as const,
                cell: (payment: RentalPayment) =>
                  payment.voidedAt === null ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onVoid(payment);
                      }}
                    >
                      Anular
                    </Button>
                  ) : null,
              },
            ]
          : []),
      ]}
    />
  );
}

function FinesTable({
  page,
  isLoading,
  errorMessage,
}: {
  page: Page<RentalFine> | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <DataTable
      rows={page?.items ?? []}
      reference={(_, index) => pagedReference(page, index)}
      isLoading={isLoading}
      errorMessage={errorMessage}
      rowKey={(fine) => fine.id}
      emptyTitle="Sin multas"
      emptyMessage="Si llega una multa de tránsito de las fechas de esta renta, se registra con «Agregar multa»."
      columns={[
        {
          key: 'description',
          header: 'Multa',
          stack: 'title',
          className: 'whitespace-normal',
          cell: (fine) => <span className="text-text">{fine.description}</span>,
        },
        {
          key: 'when',
          header: 'Fecha',
          cell: (fine) => (
            <span className="text-text-dim">
              {dayLabel(fine.occurredAt)} · {timeLabel(fine.occurredAt)}
            </span>
          ),
        },
        {
          key: 'amount',
          header: 'Monto',
          align: 'right',
          cell: (fine) => (
            <span className="font-mono tabular-nums">{formatMoney(fine.amount)}</span>
          ),
        },
        {
          key: 'charged',
          header: 'Cargo',
          stack: 'aside',
          cell: (fine) =>
            fine.chargedToCustomer ? (
              <Stamp label="Al cliente" tone="amber" />
            ) : (
              <Stamp label="Gasto del carro" tone="neutral" />
            ),
        },
      ]}
    />
  );
}
