'use client';

import { centsToMoney, moneyToCents } from '@elite/shared';
import type { VehicleMonthRow, VehicleMonths } from '@elite/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DetailField } from '@/components/ui/detail-field';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { formatCivil, todayCivil } from '@/lib/civil-date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useVehicleMonths } from '../hooks/use-rental-reports';
import { isNegative, monthLong, percentLabel, recoveredLabel, signedMoney } from '../report-view';
import { MonthsChart } from './months-chart';
import { RecoveredMeter, VerdictStamp } from './report-parts';

/**
 * La pestaña «Meses» de la ficha de un carro (100): el año mes a mes con su
 * gráfica, el punto de equilibrio y la ficha de inversión. El marco (cabecera
 * y pestañas) lo pone el layout de la 095.
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

function MonthsBody({ data }: { data: VehicleMonths }) {
  const { total, breakEven, lifetime } = data;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 [[data-density=bahia]_&]:grid-cols-1 [[data-density=bahia]_&]:sm:grid-cols-2">
        <StatCard
          label={`Ingresos ${data.year}`}
          value={signedMoney(total.income)}
          detail={`${total.agreements} ${total.agreements === 1 ? 'renta' : 'rentas'} · ${percentLabel(total.occupancy)} de ocupación`}
        />
        <StatCard
          label="Gastos, seguro y GPS"
          value={signedMoney(
            centsToMoney(moneyToCents(total.expenses) + moneyToCents(total.fixed)),
          )}
        />
        <StatCard label="Cuotas" value={signedMoney(total.installment)} />
        <StatCard
          label="Lo que quedó"
          value={signedMoney(total.net)}
          tone={isNegative(total.net) ? 'flame' : 'go'}
          detail={<VerdictStamp verdict={total.verdict} />}
        />
      </div>

      <Card className="gap-3 px-card">
        <CardSectionHeading aside="Lo que quedó cada mes">Mes a mes</CardSectionHeading>
        <MonthsChart rows={data.rows} />
      </Card>

      <DataTable<VehicleMonthRow>
        rows={data.rows}
        rowKey={(row) => row.month}
        emptyMessage="Sin meses."
        columns={[
          {
            key: 'month',
            header: 'Mes',
            stack: 'title',
            cell: (row) => <span className="text-body font-semibold">{monthLong(row.month)}</span>,
          },
          {
            key: 'income',
            header: 'Ingresos',
            align: 'right',
            cell: (row) => <Money amount={row.income} />,
          },
          {
            key: 'expenses',
            header: 'Gastos',
            align: 'right',
            cell: (row) => <Money amount={row.expenses} />,
          },
          {
            key: 'fixed',
            header: 'Fijos',
            align: 'right',
            cell: (row) => <Money amount={row.fixed} />,
          },
          {
            key: 'installment',
            header: 'Cuota',
            align: 'right',
            cell: (row) => <Money amount={row.installment} />,
          },
          {
            key: 'net',
            header: 'Neto',
            align: 'right',
            cell: (row) => <Money amount={row.net} strong />,
          },
          {
            key: 'days',
            header: 'Días rentados',
            align: 'right',
            cell: (row) => <span className="tabular-nums">{row.rentedDays.toFixed(1)}</span>,
          },
          {
            key: 'occupancy',
            header: 'Ocupación',
            align: 'right',
            cell: (row) => <span className="tabular-nums">{percentLabel(row.occupancy)}</span>,
          },
          {
            key: 'verdict',
            header: 'Resultado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (row) =>
              row.future ? (
                <span className="text-text-faint">Todavía no</span>
              ) : (
                <VerdictStamp verdict={row.verdict} />
              ),
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <Card className="gap-4 px-card">
          <CardSectionHeading>Punto de equilibrio</CardSectionHeading>
          {breakEven === null ? (
            <p className="text-text-dim text-body">
              Sin seguro, GPS ni cuota cargados: no hay costo fijo que cubrir.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 [[data-density=bahia]_&]:grid-cols-1">
              <DetailField label="Costo fijo al mes">
                <span className="font-mono tabular-nums">{formatMoney(breakEven.monthlyCost)}</span>
              </DetailField>
              <DetailField label="Días de renta para cubrirlo">
                {breakEven.days === null ? (
                  <span className="text-text-faint">Falta la tarifa diaria</span>
                ) : (
                  <span className="tabular-nums">{breakEven.days.toFixed(1)} días al mes</span>
                )}
              </DetailField>
            </div>
          )}
        </Card>

        <Card className="gap-4 px-card">
          <CardSectionHeading aside={recoveredLabel(lifetime)}>Inversión</CardSectionHeading>
          <div className="grid grid-cols-2 gap-4 [[data-density=bahia]_&]:grid-cols-1">
            <DetailField label="Desembolsado">
              <span className="font-mono tabular-nums">{formatMoney(lifetime.disbursed)}</span>
              <span className="text-text-faint block text-dense">
                {lifetime.financed ? 'Prima más cuotas pagadas' : 'Precio al contado'}
              </span>
            </DetailField>
            <DetailField label="Cuotas pagadas">
              {lifetime.financed ? (
                <span className="tabular-nums">
                  {lifetime.installmentsPaid}
                  {lifetime.termMonths === null ? null : (
                    <span className="text-text-faint"> de {lifetime.termMonths}</span>
                  )}
                </span>
              ) : (
                <span className="text-text-faint">Al contado</span>
              )}
            </DetailField>
            <DetailField label="Pendiente">
              {lifetime.pending === null ? (
                <span className="text-text-faint">—</span>
              ) : (
                <span className="font-mono tabular-nums">{formatMoney(lifetime.pending)}</span>
              )}
            </DetailField>
            <DetailField label="Recuperado">
              <RecoveredMeter lifetime={lifetime} />
              <span className="text-text-faint block text-dense">
                Dejó {signedMoney(lifetime.operating)} antes de cuotas
                {lifetime.since === null ? '' : ` desde el ${formatCivil(lifetime.since)}`}
              </span>
            </DetailField>
          </div>
        </Card>
      </div>
    </>
  );
}
