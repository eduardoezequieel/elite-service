'use client';

import type { CashSessionDetail } from '@elite/shared';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { formatSessionSpan, formatWhen, moneyParts } from '../cash-format';
import { useCashSession } from '../hooks/use-cash';
import { CashDifferenceStamp } from './cash-difference-stamp';
import { CashMethodStats } from './cash-method-stats';
import { CashPaymentsTable } from './cash-payments-table';
import { DetailSkeleton } from '@/components/ui/skeleton';

export function CashSessionDetailScreen({ id }: { id: string }) {
  const session = useCashSession(id);

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

  return <CashSessionDetail session={session.data} />;
}

function CashSessionDetail({ session }: { session: CashSessionDetail }) {
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
          <Signature label="Abrió" name={session.openedBy.fullName} at={session.openedAt} />
          <Signature label="Cerró" name={session.closedBy?.fullName ?? '—'} at={session.closedAt} />
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-title text-text">Cobrado</h2>
        <CashMethodStats totals={session} payments={session.payments} />
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

      <CashPaymentsTable payments={session.payments} />
    </div>
  );
}

/** Quién firmó el turno y cuándo: el nombre bajo el rótulo, nunca al otro extremo. */
function Signature({ label, name, at }: { label: string; name: string; at: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-body font-medium">{name}</span>
      <span className="text-text-dim text-dense">{at === null ? '—' : formatWhen(at)}</span>
    </div>
  );
}
