'use client';

import type { CashSession, Page } from '@elite/shared';
import { useSearchParams } from 'next/navigation';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { pageParam } from '@/lib/list-params';
import { moneyParts } from '@/lib/money';

import type { CashShiftAdapter, CashShiftPayment } from '../adapter';
import { formatSessionSpan, formatWhen } from '../cash-format';
import { useCashShiftSession } from '../hooks/use-cash-shift';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CashMethodStats, type CashMethodPayment } from './cash-method-stats';
import { CashPaymentsTable } from './cash-payments-table';

interface ShiftDetail<TPayment extends CashShiftPayment> extends CashSession {
  payments: Page<TPayment>;
  otherPayments: readonly CashMethodPayment[];
}

export function CashShiftSessionScreen<TPayment extends CashShiftPayment>({
  id,
  adapter,
}: {
  id: string;
  adapter: CashShiftAdapter<TPayment>;
}) {
  const searchParams = useSearchParams();
  const [page, setPage] = useListPage(pageParam(searchParams.get('page')), id);
  const session = useCashShiftSession<ShiftDetail<TPayment>>(adapter, id, page);

  if (session.isPending) {
    return <DetailSkeleton label="Cargando el turno" />;
  }

  if (session.error !== null || session.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {session.error?.message ?? 'No se pudo cargar el turno.'}
      </p>
    );
  }

  return <CashSessionDetail adapter={adapter} session={session.data} onPageChange={setPage} />;
}

function CashSessionDetail<TPayment extends CashShiftPayment>({
  adapter,
  session,
  onPageChange,
}: {
  adapter: CashShiftAdapter<TPayment>;
  session: ShiftDetail<TPayment>;
  onPageChange: (page: number) => void;
}) {
  const float = moneyParts(session.openingFloat);
  const expected = moneyParts(session.expectedCash ?? '0.00');
  const counted = session.countedCash === null ? null : moneyParts(session.countedCash);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Turno de caja"
        subtitle={formatSessionSpan(session.openedAt, session.closedAt)}
      >
        <CashDifferenceStamp difference={session.differenceCash} />
      </ScreenHeader>

      <Card className="gap-4 px-card">
        <CardSectionHeading>Turno</CardSectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Signature
            label="Abrió"
            name={session.openedBy.fullName}
            at={session.openedAt}
            showName={adapter.showActors}
          />
          <Signature
            label="Cerró"
            name={session.closedBy?.fullName ?? '—'}
            at={session.closedAt}
            showName={adapter.showActors}
          />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Cobrado</h2>
        <CashMethodStats totals={session} payments={session.otherPayments} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Efectivo en el cajón</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <StatCard label="Fondo" value={float.whole} unit={float.fraction} />
          <StatCard label="Esperado" value={expected.whole} unit={expected.fraction} />
          <StatCard
            label="Contado"
            value={counted?.whole ?? '—'}
            unit={counted?.fraction ?? undefined}
          />
        </div>
      </section>

      {session.notes === null ? null : (
        <Card className="gap-2.5 px-card">
          <CardSectionHeading>Notas</CardSectionHeading>
          <p className="text-text text-body whitespace-pre-line">{session.notes}</p>
        </Card>
      )}

      <CashPaymentsTable
        adapter={adapter}
        payments={session.payments}
        onPageChange={onPageChange}
      />
    </div>
  );
}

/** Quién firmó el turno y cuándo. Sin actores, queda solo la hora. */
function Signature({
  label,
  name,
  at,
  showName,
}: {
  label: string;
  name: string;
  at: string | null;
  showName: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-faint text-label">{label}</span>
      {showName ? <span className="text-text text-body font-medium">{name}</span> : null}
      <span className="text-text-dim text-dense">{at === null ? '—' : formatWhen(at)}</span>
    </div>
  );
}
