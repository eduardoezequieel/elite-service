'use client';

import { useMemo } from 'react';
import type {
  PerformanceEmployeeDetail,
  PerformanceExtraCount,
  PerformanceReport,
} from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { formatCents, formatMoney, moneyParts, toCents } from '@/lib/money';
import { formatWhen } from '../../cash-format';
import { firstName, percent, plural } from '../../performance';
import { referenceOf } from '../../reference';
import { PerformanceBars, type BarDatum } from './performance-bars';
import {
  EmployeeName,
  ExtraChip,
  FigureStat,
  GaugeStat,
  NO_WASHES_TEAM,
  Note,
  PERFORMANCE_HELP,
  PerformanceCard,
  StatGrid,
  WASH_PAGE_SIZE,
  noWashesForEmployee,
} from './performance-parts';
import { VersusTeam } from './performance-summary';

function extraBars(extras: readonly PerformanceExtraCount[]): BarDatum[] {
  return extras.map((extra) => ({
    key: extra.serviceName,
    label: extra.serviceName,
    value: extra.count,
    valueLabel: `${extra.count} · ${formatMoney(extra.total)}`,
    tip: `${extra.serviceName}: ${plural(extra.count, 'vez', 'veces')}, ${formatMoney(extra.total)}`,
  }));
}

function cents(amount: string): number {
  return toCents(amount) ?? 0;
}

/** Extras del equipo: el medidor, lo vendido, el que más sale, las barras y la tabla. */
export function TeamExtras({
  report,
  onSelectEmployee,
}: {
  report: PerformanceReport;
  onSelectEmployee: (employeeId: string) => void;
}) {
  const team = report.team;
  const rows = useMemo(
    () =>
      report.employees
        .filter((row) => row.washCount > 0)
        .sort(
          (left, right) =>
            right.withExtrasCount / right.washCount - left.withExtrasCount / left.washCount,
        ),
    [report.employees],
  );

  if (team.washCount === 0) {
    return <EmptyState title={NO_WASHES_TEAM.title} description={NO_WASHES_TEAM.description} />;
  }

  const sold = moneyParts(team.extrasTotal);
  const top = team.extras[0];

  return (
    <div className="flex flex-col gap-[18px]">
      <StatGrid>
        <GaugeStat
          label="Lavados con extras"
          help={PERFORMANCE_HELP.withExtras}
          value={team.withExtrasCount}
          of={team.washCount}
          detail="algo más que el lavado"
        />
        <FigureStat
          label="Vendido en extras"
          help={PERFORMANCE_HELP.extrasTotal}
          value={sold.whole}
          unit={sold.fraction}
          detail={`${percent(cents(team.extrasTotal), cents(team.salesAttributed)) ?? 0}% de las ventas`}
        />
        <FigureStat
          label="El que más sale"
          help={PERFORMANCE_HELP.topExtra}
          value={top === undefined ? '—' : top.serviceName}
          text={top !== undefined}
          detail={
            top === undefined
              ? undefined
              : `${plural(top.count, 'vez', 'veces')} · ${formatMoney(top.total)}`
          }
        />
      </StatGrid>

      <PerformanceCard title="Qué extras se venden" aside={<Note>Veces · monto</Note>}>
        {team.extras.length > 0 ? (
          <PerformanceBars rows={extraBars(team.extras)} />
        ) : (
          <EmptyState
            title="Ningún extra vendido"
            description="Cuando un lavado lleve algo más que el lavado —tapicería, pulidos, chasis— acá aparece qué se vende."
          />
        )}
      </PerformanceCard>

      <PerformanceCard title="Por empleado">
        <DataTable
          rows={rows}
          rowKey={(row) => row.employeeId}
          onRowClick={(row) => onSelectEmployee(row.employeeId)}
          emptyMessage="Cuando un empleado activo cobre lavados en estas fechas, aparece acá."
          columns={[
            {
              key: 'name',
              header: 'Empleado',
              stack: 'title',
              cell: (row) => <EmployeeName fullName={row.fullName} />,
            },
            { key: 'washes', header: 'Lavados', align: 'right', cell: (row) => row.washCount },
            {
              key: 'with',
              header: 'Con extras',
              align: 'right',
              cell: (row) => row.withExtrasCount,
            },
            {
              key: 'share',
              header: '%',
              align: 'right',
              help: PERFORMANCE_HELP.extrasShare,
              cell: (row) => (
                <b className="font-semibold">{percent(row.withExtrasCount, row.washCount) ?? 0}%</b>
              ),
            },
            {
              key: 'sold',
              header: 'Vendido en extras',
              align: 'right',
              cell: (row) => <span className="font-mono">{formatMoney(row.extrasTotal)}</span>,
            },
          ]}
        />
      </PerformanceCard>

      <Note>
        Extra es todo servicio de una categoría que cuenta como extra en el catálogo. Cuenta en los
        lavados asignados al empleado.
      </Note>
    </div>
  );
}

/** Extras de un empleado: lo suyo contra el equipo y sus lavados con extras. */
export function EmployeeExtras({ detail }: { detail: PerformanceEmployeeDetail }) {
  const mine = detail.figures;
  const team = detail.team;
  const withExtras = useMemo(
    () => detail.washes.filter((wash) => wash.extras.length > 0),
    [detail.washes],
  );

  if (mine.washCount === 0) {
    const empty = noWashesForEmployee(detail.employee.fullName);

    return <EmptyState title={empty.title} description={empty.description} />;
  }

  const sold = moneyParts(mine.extrasTotal);
  const perWash = formatCents(cents(mine.extrasTotal) / mine.washCount);
  const teamPerWash = formatCents(
    team.washCount > 0 ? cents(team.extrasTotal) / team.washCount : 0,
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <StatGrid>
        <GaugeStat
          label="Lavados con extras"
          help={PERFORMANCE_HELP.withExtras}
          value={mine.withExtrasCount}
          of={mine.washCount}
          detail={
            <VersusTeam
              mine={percent(mine.withExtrasCount, mine.washCount)}
              team={percent(team.withExtrasCount, team.washCount)}
            />
          }
        />
        <FigureStat
          label="Vendido en extras"
          help={PERFORMANCE_HELP.extrasTotal}
          value={sold.whole}
          unit={sold.fraction}
          detail={`${perWash} por lavado · equipo ${teamPerWash}`}
        />
      </StatGrid>

      {mine.extras.length > 0 ? (
        <PerformanceCard title="Qué vendió" aside={<Note>Veces · monto</Note>}>
          <PerformanceBars rows={extraBars(mine.extras)} />
        </PerformanceCard>
      ) : null}

      <PerformanceCard
        title="Sus lavados con extras"
        aside={<Note>{plural(withExtras.length, 'lavado', 'lavados')}</Note>}
      >
        <DataTable
          rows={withExtras}
          rowKey={(wash) => wash.workOrderId}
          reference={(wash) => referenceOf(wash.ticketNumber)}
          rowHref={(wash) => `/carwash/${wash.workOrderId}`}
          pageSize={WASH_PAGE_SIZE}
          emptyTitle="Ningún lavado con extras"
          emptyMessage={`Cuando ${firstName(detail.employee.fullName)} venda algo más que el lavado, acá aparece cada uno.`}
          columns={[
            {
              key: 'plate',
              header: 'Placa',
              stack: 'title',
              cell: (wash) => <PlateChip plate={wash.plate} />,
            },
            {
              key: 'charged',
              header: 'Fecha',
              cell: (wash) => <span className="text-text-dim">{formatWhen(wash.chargedAt)}</span>,
            },
            {
              key: 'extras',
              header: 'Extras',
              className: 'whitespace-normal',
              cell: (wash) => (
                <span className="inline-flex flex-wrap justify-end gap-1 min-[1100px]:justify-start">
                  {wash.extras.map((extra, index) => (
                    <ExtraChip key={`${extra.serviceName}-${index}`}>{extra.serviceName}</ExtraChip>
                  ))}
                </span>
              ),
            },
            {
              key: 'sold',
              header: 'En extras',
              align: 'right',
              cell: (wash) => (
                <b className="font-mono font-semibold">{formatMoney(wash.extrasTotal)}</b>
              ),
            },
          ]}
        />
      </PerformanceCard>
    </div>
  );
}
