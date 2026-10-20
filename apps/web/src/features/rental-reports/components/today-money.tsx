'use client';

import type { ProfitabilityTotals } from '@elite/shared';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { moneyParts } from '@/lib/money';
import { isNegative, signedMoney, spentOf } from '../report-view';

const STATS = 'grid grid-cols-2 gap-3 xl:grid-cols-4 [[data-density=bahia]_&]:grid-cols-2';

/** «Dinero» (125): lo cobrado hoy y, con `rentals.reports`, el mes hasta hoy. */
export function TodayMoney({
  collected,
  collectedLoading,
  collectedError,
  canCharge,
  totals,
  monthLoading,
  monthError,
  monthLabel,
  showMonth,
}: {
  collected: string | null;
  collectedLoading: boolean;
  collectedError: string | null;
  canCharge: boolean;
  totals: ProfitabilityTotals | null;
  monthLoading: boolean;
  monthError: string | null;
  monthLabel: string;
  showMonth: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title text-text">Dinero</h2>
      <div className={STATS}>
        {collectedLoading ? (
          <Skeleton className="h-24 rounded-row" />
        ) : collected !== null ? (
          <CollectedToday amount={collected} linked={canCharge} />
        ) : null}
        {showMonth && monthLoading
          ? [0, 1, 2].map((key) => <Skeleton key={key} className="h-24 rounded-row" />)
          : null}
        {showMonth && totals !== null ? <MonthCards totals={totals} month={monthLabel} /> : null}
      </div>
      {collectedError !== null ? <LoadError message={collectedError} /> : null}
      {monthError !== null ? <LoadError message={monthError} /> : null}
    </section>
  );
}

function CollectedToday({ amount, linked }: { amount: string; linked: boolean }) {
  const parts = moneyParts(amount);
  const card = <StatCard label="Cobrado hoy" value={parts.whole} unit={parts.fraction} tone="go" />;

  if (!linked) return card;

  return (
    <Link
      href="/rentals/cash"
      className="block rounded-row hover:[&_[data-slot=stat-card]]:border-flame"
    >
      {card}
    </Link>
  );
}

function MonthCards({ totals, month }: { totals: ProfitabilityTotals; month: string }) {
  const rented = figure(totals.income);
  const spent = figure(spentOf(totals));
  const net = figure(totals.net);

  return (
    <>
      <StatCard label={`Rentado en ${month}`} value={rented.value} unit={rented.unit} />
      <StatCard label={`Gastos de ${month}`} value={spent.value} unit={spent.unit} />
      <StatCard label={`Ganancia de ${month}`} value={net.value} unit={net.unit} />
    </>
  );
}

function figure(amount: string): { value: string; unit?: string } {
  if (isNegative(amount)) return { value: signedMoney(amount) };

  const parts = moneyParts(amount);

  return { value: parts.whole, unit: parts.fraction };
}

function LoadError({ message }: { message: string }) {
  return (
    <p className="text-danger-text text-body" role="alert">
      {message}
    </p>
  );
}
