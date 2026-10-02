'use client';

import { fleetVehicleName } from '@elite/shared';
import type { ProfitabilityReport, ProfitabilityRow } from '@elite/shared';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { PlateChip } from '@/components/ui/plate-chip';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { todayCivil, type CivilRange } from '@/lib/civil-date';
import { formatMoney, moneyParts } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useProfitability } from '../hooks/use-rental-reports';
import {
  PROFITABILITY_PRESETS,
  isNegative,
  matchingProfitabilityPreset,
  percentLabel,
  profitabilityRange,
  signedMoney,
} from '../report-view';
import { RecoveredMeter, ReportSection, VerdictStamp } from './report-parts';

/**
 * Rentabilidad por carro (100, `rentals.reports`): cuánto dejó cada carro en
 * el periodo después de gastos, seguro, GPS y cuota, el veredicto y cuánto de
 * la inversión ya recuperó. Tocar un carro abre su pestaña «Meses».
 */
export function ProfitabilityScreen() {
  const today = todayCivil();
  const [range, setRange] = useState<CivilRange>(() => profitabilityRange('month', today));
  const report = useProfitability(range);
  const preset = matchingProfitabilityPreset(range, today);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Rentabilidad"
        subtitle="Cuánto dejó cada carro después de gastos, seguro, GPS y cuota"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Periodo" className="flex flex-wrap gap-2">
          {PROFITABILITY_PRESETS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={preset === option.key}
              onClick={() => setRange(profitabilityRange(option.key, today))}
              className={cn(
                'border-line bg-surface-2 inline-flex min-h-(--touch-min) items-center rounded-control border px-4 text-body font-semibold',
                'transition-colors duration-(--duration-state) ease-standard hover:border-flame [[data-density=bahia]_&]:px-5',
                preset === option.key ? 'border-flame text-text' : 'text-text-dim',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <DateRangeField value={range} onChange={setRange} aria-label="Periodo de la rentabilidad" />
      </div>

      {report.isPending ? (
        <DetailSkeleton label="Calculando la rentabilidad" />
      ) : report.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {report.error.message}
        </p>
      ) : (
        <ProfitabilityBody report={report.data} />
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

function ProfitabilityBody({ report }: { report: ProfitabilityReport }) {
  const { totals } = report;
  const income = moneyParts(totals.income);
  const expenses = moneyParts(totals.expenses);
  const fixed = moneyParts(totals.fixed);
  const installment = moneyParts(totals.installment);
  const net = isNegative(totals.net) ? null : moneyParts(totals.net);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 [[data-density=bahia]_&]:grid-cols-1 [[data-density=bahia]_&]:sm:grid-cols-2">
        <StatCard
          label="Ingresos"
          value={income.whole}
          unit={income.fraction}
          detail={`${totals.agreements} ${totals.agreements === 1 ? 'renta' : 'rentas'} · ${percentLabel(totals.occupancy)} de ocupación`}
        />
        <StatCard
          label="Gastos"
          value={expenses.whole}
          unit={expenses.fraction}
          detail="Mantenimiento, lavados y multas"
        />
        <StatCard
          label="Seguro y GPS"
          value={fixed.whole}
          unit={fixed.fraction}
          detail="Fijos del periodo"
        />
        <StatCard
          label="Cuotas"
          value={installment.whole}
          unit={installment.fraction}
          detail="Pagos al banco del periodo"
        />
        <StatCard
          label="Lo que quedó"
          value={net === null ? signedMoney(totals.net) : net.whole}
          unit={net === null ? undefined : net.fraction}
          tone={net === null ? 'flame' : 'go'}
          detail={`${totals.verdicts.GAIN} con ganancia, ${totals.verdicts.EVEN} a la par, ${totals.verdicts.LOSS} en pérdida`}
        />
      </div>

      <ReportSection title="Por carro" aside="Tocá un carro para ver su historia mes a mes">
        <DataTable<ProfitabilityRow>
          rows={report.rows}
          rowKey={(row) => row.vehicle.id}
          rowHref={(row) => `/rentals/fleet/${row.vehicle.id}/months`}
          emptyTitle="Sin carros"
          emptyMessage="Agregá tu flota para ver su rentabilidad."
          columns={[
            {
              key: 'vehicle',
              header: 'Carro',
              stack: 'title',
              className: 'whitespace-normal',
              cell: (row) => (
                <span className="flex flex-col gap-1">
                  <span className="text-body font-semibold">{fleetVehicleName(row.vehicle)}</span>
                  {row.vehicle.plate === null ? (
                    <span className="text-text-faint text-dense">Sin placa</span>
                  ) : (
                    <PlateChip plate={row.vehicle.plate} size="sm" />
                  )}
                </span>
              ),
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
              header: 'Seguro y GPS',
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
              header: 'Lo que quedó',
              align: 'right',
              cell: (row) => <Money amount={row.net} strong />,
            },
            {
              key: 'occupancy',
              header: 'Ocupación',
              align: 'right',
              cell: (row) => (
                <span className="tabular-nums">
                  {percentLabel(row.occupancy)}
                  <span className="text-text-faint"> · {row.rentedDays.toFixed(1)} d</span>
                </span>
              ),
            },
            {
              key: 'perDay',
              header: 'Por día',
              align: 'right',
              cell: (row) => (
                <span className="font-mono tabular-nums">{formatMoney(row.incomePerDay)}</span>
              ),
            },
            {
              key: 'recovered',
              header: 'Recuperado',
              help: 'Lo que el carro ha dejado antes de cuotas contra lo desembolsado: la prima más las cuotas pagadas, o el precio si fue al contado.',
              cell: (row) => <RecoveredMeter lifetime={row.lifetime} />,
            },
            {
              key: 'verdict',
              header: 'Resultado',
              stack: 'aside',
              className: 'whitespace-nowrap',
              cell: (row) => <VerdictStamp verdict={row.verdict} />,
            },
          ]}
        />
      </ReportSection>

      <p className="text-text-faint text-dense [[data-density=bahia]_&]:text-body">
        Si una renta cruza de un mes a otro, su ingreso se reparte según el tiempo que cayó en cada
        periodo. El seguro, el GPS y la cuota se cargan por mes desde la fecha de compra. Los
        ingresos van sin IVA.
      </p>
    </>
  );
}
