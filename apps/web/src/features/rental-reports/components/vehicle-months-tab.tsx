'use client';

import type { VehicleMonthRow, VehicleMonths } from '@elite/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { todayCivil } from '@/lib/civil-date';
import { moneyParts } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useVehicleMonths } from '../hooks/use-rental-reports';
import { isNegative, monthLong, signedMoney, spentOf } from '../report-view';
import { MonthsChart } from './months-chart';

/**
 * ¿Cuánto dejó? de un carro (110): el año mes a mes. Entró, Se fue y Quedó.
 * El marco lo pone el layout de la ficha.
 */
export function VehicleMonthsTab({ id }: { id: string }) {
  const currentYear = Number(todayCivil().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const months = useVehicleMonths(id, year);

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
        <MonthsBody data={months.data} />
      )}
    </div>
  );
}

function Money({ amount, strong = false }: { amount: string; strong?: boolean }) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        strong && 'font-semibold',
        isNegative(amount) && 'text-danger-text',
      )}
    >
      {signedMoney(amount)}
    </span>
  );
}

function cardAmount(amount: string): { value: string; unit?: string } {
  if (isNegative(amount)) return { value: signedMoney(amount) };

  const parts = moneyParts(amount);

  return { value: parts.whole, unit: parts.fraction };
}

function MonthsBody({ data }: { data: VehicleMonths }) {
  const { total } = data;
  const entered = cardAmount(total.income);
  const spent = cardAmount(total.costs);
  const left = cardAmount(total.net);

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
        <CardSectionHeading>Mes a mes</CardSectionHeading>
        <MonthsChart rows={data.rows} />
      </Card>

      <DataTable<VehicleMonthRow>
        rows={data.rows}
        rowKey={(row) => row.month}
        emptyTitle="Nada todavía"
        emptyMessage=""
        columns={[
          {
            key: 'month',
            header: 'Mes',
            stack: 'title',
            cell: (row) => <span className="text-body font-semibold">{monthLong(row.month)}</span>,
          },
          {
            key: 'income',
            header: 'Entró',
            align: 'right',
            cell: (row) => <Money amount={row.income} />,
          },
          {
            key: 'spent',
            header: 'Se fue',
            align: 'right',
            cell: (row) => <Money amount={spentOf(row)} />,
          },
          {
            key: 'net',
            header: 'Quedó',
            align: 'right',
            cell: (row) => <Money amount={row.net} strong />,
          },
        ]}
      />
    </>
  );
}
