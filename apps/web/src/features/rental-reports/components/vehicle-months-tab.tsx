'use client';

import { VERDICT_LABELS, moneyToCents } from '@elite/shared';
import type { VehicleMonthRow, VehicleMonths } from '@elite/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { todayCivil } from '@/lib/civil-date';
import { moneyParts } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useVehicleMonths } from '../hooks/use-rental-reports';
import {
  VERDICT_TONES,
  isNegative,
  monthDetailLine,
  monthName,
  signedMoney,
  spentOf,
} from '../report-view';
import { MonthsChart } from './months-chart';

/**
 * ¿Cuánto dejó? de un carro (110): el año en tres cifras y en la gráfica.
 * La gráfica elige el mes; abajo se abre solo ese. El marco lo pone el layout.
 */
export function VehicleMonthsTab({ id }: { id: string }) {
  const today = todayCivil();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const months = useVehicleMonths(id, year);
  const selected = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Año anterior"
          onClick={() => setYear(year - 1)}
        >
          <ChevronLeft strokeWidth={1.5} />
        </Button>
        <span
          className="text-title text-text min-w-16 text-center font-mono tabular-nums"
          aria-live="polite"
        >
          {year}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Año siguiente"
          disabled={year >= currentYear}
          onClick={() => setYear(year + 1)}
        >
          <ChevronRight strokeWidth={1.5} />
        </Button>
      </div>

      {months.isPending ? (
        <DetailSkeleton label="Cargando los meses" />
      ) : months.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {months.error.message}
        </p>
      ) : (
        <MonthsBody
          data={months.data}
          today={today}
          selected={selected}
          onSelect={(next) => setMonth(Number(next.slice(5, 7)))}
        />
      )}
    </div>
  );
}

function cardAmount(amount: string): { value: string; unit?: string } {
  if (isNegative(amount)) return { value: signedMoney(amount) };

  const parts = moneyParts(amount);

  return { value: parts.whole, unit: parts.fraction };
}

function MonthsBody({
  data,
  today,
  selected,
  onSelect,
}: {
  data: VehicleMonths;
  today: string;
  selected: string;
  onSelect: (month: string) => void;
}) {
  const { total } = data;
  const entered = cardAmount(total.income);
  const spent = cardAmount(total.costs);
  const left = cardAmount(total.net);
  const row = data.rows.find((item) => item.month === selected) ?? data.rows[0];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [[data-density=bahia]_&]:grid-cols-1">
        <StatCard label="Entró" value={entered.value} unit={entered.unit} />
        <StatCard label="Se fue" value={spent.value} unit={spent.unit} />
        <StatCard
          label="Quedó"
          value={left.value}
          unit={left.unit}
          tone={isNegative(total.net) ? 'flame' : 'go'}
        />
      </div>

      <Card className="gap-3 px-card">
        <MonthsChart rows={data.rows} selected={row?.month ?? selected} onSelect={onSelect} />
      </Card>

      {row === undefined ? null : <MonthPanel row={row} today={today} onSelect={onSelect} />}
    </>
  );
}

function MonthPanel({
  row,
  today,
  onSelect,
}: {
  row: VehicleMonthRow;
  today: string;
  onSelect: (month: string) => void;
}) {
  const index = Number(row.month.slice(5, 7));
  const year = row.month.slice(0, 4);
  const detail = monthDetailLine(row, today);
  const quiet = row.future
    ? 'Todavía no empieza.'
    : row.verdict === 'NONE'
      ? 'No tuvo movimiento.'
      : null;

  function shift(delta: number) {
    const next = index + delta;

    if (next < 1 || next > 12) return;

    onSelect(`${year}-${String(next).padStart(2, '0')}`);
  }

  return (
    <Card className="px-card" aria-live="polite">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Mes anterior"
          disabled={index <= 1}
          onClick={() => shift(-1)}
        >
          <ChevronLeft strokeWidth={1.5} />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-headline text-text">{monthName(row.month)}</h2>
            {row.future ? null : (
              <Stamp tone={VERDICT_TONES[row.verdict]} label={VERDICT_LABELS[row.verdict]} />
            )}
          </div>
          {detail === null ? null : (
            <p className="text-text-dim mt-0.5 text-dense [[data-density=bahia]_&]:text-body">
              {detail}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Mes siguiente"
          disabled={index >= 12}
          onClick={() => shift(1)}
        >
          <ChevronRight strokeWidth={1.5} />
        </Button>
      </div>
      <div>
        {quiet === null ? (
          <MonthFigures row={row} />
        ) : (
          <p className="text-text-dim text-body">{quiet}</p>
        )}
      </div>
    </Card>
  );
}

function MonthFigures({ row }: { row: VehicleMonthRow }) {
  const lines = [
    ['Gastos', row.expenses],
    ['Seguro y GPS', row.fixed],
    ['Cuota', row.installment],
  ].filter(([, amount]) => moneyToCents(amount) !== 0);

  return (
    <>
      <div className="border-line-soft mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
        <Figure label="Entró" amount={row.income} />
        <Figure label="Se fue" amount={spentOf(row)} />
        <Figure label="Quedó" amount={row.net} tone={netTone(row.net)} />
      </div>
      {lines.length === 0 ? null : (
        <dl className="mt-3">
          {lines.map(([label, amount]) => (
            <div
              key={label}
              className="border-line-soft flex items-baseline justify-between gap-4 border-t py-2"
            >
              <dt className="text-text-dim font-medium">{label}</dt>
              <dd className="font-mono font-bold tabular-nums">{signedMoney(amount)}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function netTone(amount: string): 'go' | 'flame' | undefined {
  if (isNegative(amount)) return 'flame';
  if (moneyToCents(amount) > 0) return 'go';

  return undefined;
}

function Figure({ label, amount, tone }: { label: string; amount: string; tone?: 'go' | 'flame' }) {
  const negative = isNegative(amount);
  const parts = negative ? null : moneyParts(amount);

  return (
    <div className="min-w-0">
      <p className="text-text-dim m-0 text-dense font-medium [[data-density=bahia]_&]:text-body">
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 flex items-baseline font-display text-(length:--stat-size) font-bold italic leading-none tabular-nums tracking-tight',
          tone === 'go' && 'text-go-text',
          (tone === 'flame' || negative) && 'text-flame-text',
        )}
      >
        {negative || parts === null ? (
          <span>{signedMoney(amount)}</span>
        ) : (
          <>
            <span>{parts.whole}</span>
            <span className="text-title text-text-faint font-sans font-medium not-italic">
              {parts.fraction}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
