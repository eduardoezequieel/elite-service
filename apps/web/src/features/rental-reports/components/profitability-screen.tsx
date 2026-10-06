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
import { FleetViewSwitch } from '@/features/fleet/components/fleet-view-switch';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { todayCivil, type CivilRange } from '@/lib/civil-date';
import { moneyParts } from '@/lib/money';
import { useUrlPage } from '@/lib/use-url-page';
import { cn } from '@/lib/utils';
import { useProfitability } from '../hooks/use-rental-reports';
import {
  PROFITABILITY_PRESETS,
  isNegative,
  matchingProfitabilityPreset,
  profitabilityRange,
  signedMoney,
  spentOf,
} from '../report-view';

/**
 * ¿Cuánto dejó? de la flota (110, `rentals.reports`): una fila por carro con
 * Entró, Se fue y Quedó. «Este mes» corta hoy.
 */
const PAGE_SIZE = 25;

export function ProfitabilityScreen({ initialPage = 1 }: { initialPage?: number }) {
  const today = todayCivil();
  const [range, setRange] = useState<CivilRange>(() => profitabilityRange('month', today));
  const [page, setPage] = useUrlPage('page', initialPage, `${range.from}|${range.to}`);
  const report = useProfitability({ ...range, page, pageSize: PAGE_SIZE });
  const preset = matchingProfitabilityPreset(range, today);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="¿Cuánto dejó?">
        <FleetViewSwitch current="earnings" />
      </ScreenHeader>

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
        <DateRangeField value={range} onChange={setRange} aria-label="Periodo" />
      </div>

      {report.isPending ? (
        <DetailSkeleton label="Calculando cuánto dejó" />
      ) : report.error !== null ? (
        <p className="text-danger-text text-body" role="alert">
          {report.error.message}
        </p>
      ) : (
        <ProfitabilityBody report={report.data} onPageChange={setPage} />
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

function ProfitabilityBody({
  report,
  onPageChange,
}: {
  report: ProfitabilityReport;
  onPageChange: (page: number) => void;
}) {
  const { totals } = report;
  const entered = cardAmount(totals.income);
  const spent = cardAmount(spentOf(totals));
  const left = cardAmount(totals.net);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 [[data-density=bahia]_&]:grid-cols-1">
        <StatCard label="Entró" value={entered.value} unit={entered.unit} />
        <StatCard label="Se fue" value={spent.value} unit={spent.unit} />
        <StatCard
          label="Quedó"
          value={left.value}
          unit={left.unit}
          tone={isNegative(totals.net) ? 'flame' : 'go'}
        />
      </div>

      <DataTable<ProfitabilityRow>
        rows={report.rows.items}
        rowKey={(row) => row.vehicle.id}
        reference={(_, index) => pagedReference(report.rows, index)}
        rowHref={(row) => `/rentals/fleet/${row.vehicle.id}/months`}
        emptyTitle="Nada todavía"
        emptyMessage=""
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
            header: 'Entró',
            align: 'right',
            cell: (row) => <Money amount={row.income} />,
          },
          {
            key: 'costs',
            header: 'Se fue',
            align: 'right',
            cell: (row) => <Money amount={row.costs} />,
          },
          {
            key: 'net',
            header: 'Quedó',
            align: 'right',
            cell: (row) => <Money amount={row.net} strong />,
          },
        ]}
      />
      <Pager
        page={report.rows}
        noun={{ one: 'carro', many: 'carros' }}
        onPageChange={onPageChange}
      />
    </>
  );
}
