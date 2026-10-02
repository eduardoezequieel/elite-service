'use client';

import { useMemo } from 'react';
import type {
  PerformanceEmployeeDetail,
  PerformanceReport,
  PerformanceReturnsRange,
} from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { formatWhen } from '../../cash-format';
import { firstName, percent, plural, rangeLabel } from '../../performance';
import { referenceOf } from '../../reference';
import {
  Callout,
  EmployeeName,
  FigureStat,
  GaugeStat,
  Note,
  PERFORMANCE_HELP,
  PerformanceCard,
  StatGrid,
  noWashesForEmployee,
} from './performance-parts';
import { VersusTeam } from './performance-summary';

/**
 * Qué lavados se miden (067 RN-6). Si el rango pide días de los que todavía
 * no se sabe si el carro vuelve, el API lo corre hacia atrás y acá se avisa.
 */
function ReturnsRangeNote({ range }: { range: PerformanceReturnsRange }) {
  const label = rangeLabel(range.returnsFrom, range.returnsTo);

  if (!range.returnsShifted) {
    return (
      <Note>Lavados del {label}: cuenta si el mismo carro volvió en los 30 días siguientes.</Note>
    );
  }

  return (
    <Callout title={`Se miden los lavados del ${label}.`}>
      Los de los últimos 30 días todavía no cuentan: no se sabe si el carro va a volver.
    </Callout>
  );
}

function daysFigure(days: number | null): { value: string; unit?: string } {
  return days === null ? { value: '—' } : { value: String(Math.round(days)), unit: 'días' };
}

/** Clientes fieles del equipo: el aviso del rango, el medidor, los días y la tabla. */
export function TeamLoyalty({
  report,
  onSelectEmployee,
  onPageChange,
}: {
  report: PerformanceReport;
  onSelectEmployee: (employeeId: string) => void;
  /** La tabla por empleado pagina en el servidor (102); las cifras son del equipo entero. */
  onPageChange: (page: number) => void;
}) {
  const team = report.team;
  const rows = useMemo(
    () =>
      report.employees.items
        .filter((row) => row.measuredCount > 0)
        .sort(
          (left, right) =>
            right.returnedCount / right.measuredCount - left.returnedCount / left.measuredCount,
        ),
    [report.employees],
  );

  if (team.measuredCount === 0) {
    return (
      <div className="flex flex-col gap-(--grid-gap)">
        <ReturnsRangeNote range={report} />
        <EmptyState
          title="Todavía no hay lavados para medir"
          description="Un lavado cuenta cuando pasan 30 días: ahí se sabe si el carro volvió o no."
        />
      </div>
    );
  }

  const days = daysFigure(team.avgReturnDays);

  return (
    <div className="flex flex-col gap-(--grid-gap)">
      <ReturnsRangeNote range={report} />
      <StatGrid>
        <GaugeStat
          label="Volvieron en 30 días"
          help={PERFORMANCE_HELP.loyal}
          value={team.returnedCount}
          of={team.measuredCount}
          detail="el mismo carro, con cualquier empleado"
        />
        <FigureStat
          label="Vuelven a los"
          help={PERFORMANCE_HELP.returnDays}
          value={days.value}
          unit={days.unit}
          detail="en promedio"
        />
      </StatGrid>

      <PerformanceCard title="Por empleado">
        <DataTable
          rows={rows}
          rowKey={(row) => row.employeeId}
          reference={(_row, index) => pagedReference(report.employees, index)}
          onRowClick={(row) => onSelectEmployee(row.employeeId)}
          emptyMessage="Cuando un empleado activo tenga lavados medidos, aparece acá."
          columns={[
            {
              key: 'name',
              header: 'Empleado',
              stack: 'title',
              cell: (row) => <EmployeeName fullName={row.fullName} />,
            },
            {
              key: 'measured',
              header: 'Lavados medidos',
              align: 'right',
              help: PERFORMANCE_HELP.measured,
              cell: (row) => row.measuredCount,
            },
            {
              key: 'returned',
              header: 'Volvieron',
              align: 'right',
              cell: (row) => row.returnedCount,
            },
            {
              key: 'share',
              header: '%',
              align: 'right',
              help: PERFORMANCE_HELP.loyalShare,
              cell: (row) => (
                <b className="font-semibold">
                  {percent(row.returnedCount, row.measuredCount) ?? 0}%
                </b>
              ),
            },
            {
              key: 'days',
              header: 'A los',
              align: 'right',
              cell: (row) =>
                row.avgReturnDays === null ? (
                  <span className="text-text-faint">—</span>
                ) : (
                  `${Math.round(row.avgReturnDays)} días`
                ),
            },
          ]}
        />

        <Pager
          page={report.employees}
          noun={{ one: 'empleado', many: 'empleados' }}
          onPageChange={onPageChange}
        />
      </PerformanceCard>
    </div>
  );
}

/** Clientes fieles de un empleado: lo suyo contra el equipo y cada lavado medido. */
export function EmployeeLoyalty({
  detail,
  onPageChange,
}: {
  detail: PerformanceEmployeeDetail;
  /** La lista de lavados pagina en el servidor (102). */
  onPageChange: (page: number) => void;
}) {
  const mine = detail.figures;
  const team = detail.team;

  if (mine.measuredCount === 0) {
    const empty = noWashesForEmployee(detail.employee.fullName);

    return (
      <div className="flex flex-col gap-(--grid-gap)">
        <ReturnsRangeNote range={detail} />
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    );
  }

  const days = daysFigure(mine.avgReturnDays);

  return (
    <div className="flex flex-col gap-(--grid-gap)">
      <ReturnsRangeNote range={detail} />
      <StatGrid>
        <GaugeStat
          label="Volvieron en 30 días"
          help={PERFORMANCE_HELP.loyal}
          value={mine.returnedCount}
          of={mine.measuredCount}
          detail={
            <VersusTeam
              mine={percent(mine.returnedCount, mine.measuredCount)}
              team={percent(team.returnedCount, team.measuredCount)}
            />
          }
        />
        <FigureStat
          label="Vuelven a los"
          help={PERFORMANCE_HELP.returnDays}
          value={days.value}
          unit={days.unit}
          detail={
            team.avgReturnDays === null
              ? undefined
              : `equipo ${Math.round(team.avgReturnDays)} días`
          }
        />
      </StatGrid>

      <DataTable
        rows={detail.returns.items}
        rowKey={(wash) => wash.workOrderId}
        reference={(wash) => referenceOf(wash.ticketNumber)}
        rowHref={(wash) => `/carwash/${wash.workOrderId}`}
        emptyMessage="Cuando sus lavados cumplan 30 días, acá aparece si el carro volvió."
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
          { key: 'body', header: 'Tipo', cell: (wash) => wash.bodyTypeName },
          {
            key: 'returned',
            header: '¿Volvió?',
            className: 'whitespace-normal',
            cell: (wash) =>
              wash.returnedAfterDays === null ? (
                <span className="text-text-faint">No</span>
              ) : (
                <span>
                  <span className="text-go-text">
                    Sí, a los {plural(wash.returnedAfterDays, 'día', 'días')}
                  </span>
                  {wash.returnedWithName === null ? null : (
                    <span className="text-text-faint text-dense">
                      {' '}
                      · lo lavó {firstName(wash.returnedWithName)}
                    </span>
                  )}
                </span>
              ),
          },
        ]}
      />

      <Pager
        page={detail.returns}
        noun={{ one: 'lavado', many: 'lavados' }}
        onPageChange={onPageChange}
      />
    </div>
  );
}
