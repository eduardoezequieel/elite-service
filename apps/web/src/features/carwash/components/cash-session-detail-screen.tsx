'use client';

import type { CashSessionDetail } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Card } from '@/components/ui/card';
import { formatMoney, formatSessionSpan } from '../cash-format';
import { useCashSession } from '../hooks/use-cash';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CashPaymentsTable } from './cash-payments-table';

export function CashSessionDetailScreen({ id }: { id: string }) {
  const session = useCashSession(id);

  if (session.isPending) {
    return <p className="text-text-dim text-body">Cargando…</p>;
  }

  if (session.error !== null || session.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {session.error?.message ?? 'No se pudo cargar el turno.'}
      </p>
    );
  }

  return <CashSessionDetail session={session.data} />;
}

function CashSessionDetail({ session }: { session: CashSessionDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Turno de caja"
        subtitle={formatSessionSpan(session.openedAt, session.closedAt)}
      >
        <CashDifferenceStamp difference={session.differenceCash} />
      </ScreenHeader>

      <Card className="gap-3 px-card">
        <Field label="Abrió" value={session.openedBy.fullName} />
        <Field label="Cerró" value={session.closedBy?.fullName ?? '—'} />
        <Field label="Fondo" value={formatMoney(session.openingFloat)} />
        <Field label="Efectivo cobrado" value={formatMoney(session.cashTotal ?? '0.00')} />
        <Field label="Tarjeta" value={formatMoney(session.cardTotal ?? '0.00')} />
        <Field label="Transferencia" value={formatMoney(session.transferTotal ?? '0.00')} />
        <Field label="Esperado" value={formatMoney(session.expectedCash ?? '0.00')} />
        <Field
          label="Contado"
          value={session.countedCash ? formatMoney(session.countedCash) : '—'}
        />
        {session.notes === null ? null : <Field label="Notas" value={session.notes} />}
      </Card>

      <CashPaymentsTable payments={session.payments} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-right text-body">{value}</span>
    </div>
  );
}
