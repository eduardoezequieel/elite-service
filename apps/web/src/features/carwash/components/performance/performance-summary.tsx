'use client';

import type { PerformanceEmployeeDetail, PerformanceReport } from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { EmptyState } from '@/components/ui/empty-state';
import { formatMoney, moneyParts } from '@/lib/money';
import {
  formatMinutes,
  minutesDelta,
  percent,
  plural,
  pointsDelta,
  rangeLabel,
} from '../../performance';
import {
  EmployeeName,
  FigureStat,
  GaugeStat,
  NO_WASHES_TEAM,
  Note,
  PERFORMANCE_HELP,
  PercentOf,
  PerformanceCard,
  SummaryGrid,
  Toned,
  noWashesForEmployee,
} from './performance-parts';

function minutesFigure(minutes: number | null): { value: string; unit?: string } {
  return minutes === null ? { value: '—' } : { value: String(Math.round(minutes)), unit: 'min' };
}

/** Resumen del equipo: tres cifras, dos medidores y la tabla por empleado. */
export function TeamSummary({
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

  if (team.washCount === 0) {
    return <EmptyState title={NO_WASHES_TEAM.title} description={NO_WASHES_TEAM.description} />;
  }

  // Cuántos cobraron: se cuenta en la página si cabe entera; si no, cuántas
  // filas tiene la tabla (102), que son los activos con lavados en el rango
  // o en el de fieles.
  const staff =
    report.employees.items.length === report.employees.total
      ? report.employees.items.filter((row) => row.washCount > 0).length
      : report.employees.total;
  const commission = moneyParts(team.commission);
  const time = minutesFigure(team.avgMinutes);
  const perBody = team.byBodyType
    .filter((body) => body.avgMinutes !== null)
    .map((body) => `${body.bodyTypeName} ${formatMinutes(body.avgMinutes)}`)
    .join(' · ');

  return (
    <div className="flex flex-col gap-(--grid-gap)">
      <SummaryGrid>
        <FigureStat
          label="Lavados cobrados"
          help={PERFORMANCE_HELP.washesCharged}
          value={team.washCount}
          detail={`entre ${plural(staff, 'empleado', 'empleados')}`}
        />
        <FigureStat
          label="Comisiones"
          help={PERFORMANCE_HELP.commissions}
          value={commission.whole}
          unit={commission.fraction}
          detail={`sobre ${formatMoney(team.salesAttributed)} en ventas`}
        />
        <FigureStat
          label="Tiempo promedio por lavado"
          help={PERFORMANCE_HELP.avgTime}
          value={time.value}
          unit={time.unit}
          detail={perBody === '' ? 'sin lavados medidos' : perBody}
        />
        <GaugeStat
          label="Con extras"
          help={PERFORMANCE_HELP.withExtras}
          value={team.withExtrasCount}
          of={team.washCount}
          detail={`${formatMoney(team.extrasTotal)} en extras`}
        />
        <GaugeStat
          label="Clientes fieles · 30 días"
          help={PERFORMANCE_HELP.loyal}
          value={team.returnedCount}
          of={team.measuredCount}
          detail={`lavados del ${rangeLabel(report.returnsFrom, report.returnsTo)}`}
        />
      </SummaryGrid>

      <PerformanceCard
        title="Por empleado"
        aside={<Note>Tocá un empleado para ver su detalle</Note>}
      >
        <DataTable
          rows={report.employees.items}
          rowKey={(row) => row.employeeId}
          reference={(_row, index) => pagedReference(report.employees, index)}
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
              key: 'commission',
              header: 'Comisión',
              align: 'right',
              cell: (row) => <span className="font-mono">{formatMoney(row.commission)}</span>,
            },
            {
              key: 'time',
              header: 'Tiempo vs promedio',
              align: 'right',
              help: PERFORMANCE_HELP.timeVsTeam,
              cell: (row) => <Toned delta={minutesDelta(row.minutesVsTeam, true)} />,
            },
            {
              key: 'extras',
              header: 'Lavados con extras',
              align: 'right',
              help: PERFORMANCE_HELP.extrasShare,
              cell: (row) => <PercentOf part={row.withExtrasCount} whole={row.washCount} />,
            },
            {
              key: 'loyal',
              header: 'Clientes fieles',
              align: 'right',
              help: PERFORMANCE_HELP.loyalShare,
              cell: (row) => <PercentOf part={row.returnedCount} whole={row.measuredCount} />,
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

/** Resumen de un empleado: lo suyo contra el equipo, en las mismas cinco cifras. */
export function EmployeeSummary({ detail }: { detail: PerformanceEmployeeDetail }) {
  const mine = detail.figures;
  const team = detail.team;

  if (mine.washCount === 0 && mine.measuredCount === 0) {
    const empty = noWashesForEmployee(detail.employee.fullName);

    return <EmptyState title={empty.title} description={empty.description} />;
  }

  const commission = moneyParts(mine.commission);
  const time = minutesFigure(mine.avgMinutes);
  const perEmployee = Math.round(team.washCount / Math.max(detail.teamEmployeeCount, 1));
  const extrasMine = percent(mine.withExtrasCount, mine.washCount);
  const extrasTeam = percent(team.withExtrasCount, team.washCount);
  const loyalMine = percent(mine.returnedCount, mine.measuredCount);
  const loyalTeam = percent(team.returnedCount, team.measuredCount);

  return (
    <SummaryGrid>
      <FigureStat
        label="Lavados cobrados"
        help={PERFORMANCE_HELP.washesCharged}
        value={mine.washCount}
        detail={`el equipo promedia ${perEmployee} por empleado`}
      />
      <FigureStat
        label="Comisión"
        help={PERFORMANCE_HELP.commission}
        value={commission.whole}
        unit={commission.fraction}
        detail={`sobre ${formatMoney(mine.salesAttributed)} en ventas`}
      />
      <FigureStat
        label="Tiempo promedio por lavado"
        help={PERFORMANCE_HELP.avgTime}
        value={time.value}
        unit={time.unit}
        detail={<Toned delta={minutesDelta(mine.minutesVsTeam)} />}
      />
      <GaugeStat
        label="Con extras"
        help={PERFORMANCE_HELP.withExtras}
        value={mine.withExtrasCount}
        of={mine.washCount}
        detail={<VersusTeam mine={extrasMine} team={extrasTeam} />}
      />
      <GaugeStat
        label="Clientes fieles · 30 días"
        help={PERFORMANCE_HELP.loyal}
        value={mine.returnedCount}
        of={mine.measuredCount}
        detail={<VersusTeam mine={loyalMine} team={loyalTeam} />}
      />
    </SummaryGrid>
  );
}

/** `equipo 40% · 5 puntos más`. */
export function VersusTeam({ mine, team }: { mine: number | null; team: number | null }) {
  const delta = pointsDelta(mine, team);

  return (
    <>
      equipo {team === null ? '—' : `${team}%`}
      {delta.text === '' ? null : (
        <>
          {' · '}
          <Toned delta={delta} />
        </>
      )}
    </>
  );
}
