'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type {
  PerformanceBodyTime,
  PerformanceEmployeeDetail,
  PerformanceEmployeeRow,
  PerformanceReport,
} from '@elite/shared';

import { DataTable } from '@/components/ui/data-table';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { EmptyState } from '@/components/ui/empty-state';
import { PlateChip } from '@/components/ui/plate-chip';
import { cn } from '@/lib/utils';
import { formatWhen } from '../../cash-format';
import { formatMinutes, minutesDelta, plural } from '../../performance';
import { referenceOf } from '../../reference';
import { PerformanceBars } from './performance-bars';
import {
  EmployeeName,
  FigureStat,
  NO_WASHES_TEAM,
  Note,
  PERFORMANCE_HELP,
  PerformanceCard,
  StatGrid,
  Toned,
  bodyTypeHelp,
  noWashesForEmployee,
} from './performance-parts';

function bodyOf(
  list: readonly PerformanceBodyTime[],
  bodyTypeId: string,
): PerformanceBodyTime | undefined {
  return list.find((body) => body.bodyTypeId === bodyTypeId);
}

function minutesFigure(minutes: number | null): { value: string; unit?: string } {
  return minutes === null ? { value: '—' } : { value: String(Math.round(minutes)), unit: 'min' };
}

/** Tiempos del equipo: una cifra por tipo de carro, las barras y la tabla. */
export function TeamTimes({
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
  const bodies = team.byBodyType;
  const [chosen, setChosen] = useState<string | null>(null);

  if (team.washCount === 0) {
    return <EmptyState title={NO_WASHES_TEAM.title} description={NO_WASHES_TEAM.description} />;
  }

  const selected =
    bodies.find((body) => body.bodyTypeId === chosen) ??
    bodies.find((body) => body.timedCount > 0) ??
    bodies[0];
  const teamAverage = selected?.avgMinutes ?? null;
  const people = report.employees.items.filter((row) => row.washCount > 0);

  const bars =
    selected === undefined
      ? []
      : report.employees.items
          .map((row) => ({ row, mine: bodyOf(row.byBodyType, selected.bodyTypeId) }))
          .filter(
            (entry): entry is { row: PerformanceEmployeeRow; mine: PerformanceBodyTime } =>
              entry.mine !== undefined && entry.mine.avgMinutes !== null,
          )
          .sort((left, right) => (left.mine.avgMinutes ?? 0) - (right.mine.avgMinutes ?? 0))
          .map(({ row, mine }) => ({
            key: row.employeeId,
            label: row.fullName,
            value: mine.avgMinutes ?? 0,
            valueLabel: formatMinutes(mine.avgMinutes),
            tip: `${row.fullName} · ${selected.bodyTypeName}: ${formatMinutes(mine.avgMinutes)} en ${plural(mine.timedCount, 'lavado', 'lavados')}. Equipo: ${formatMinutes(teamAverage)}.`,
            onSelect: () => onSelectEmployee(row.employeeId),
          }));

  return (
    <div className="flex flex-col gap-(--grid-gap)">
      <StatGrid>
        {bodies.map((body) => {
          const figure = minutesFigure(body.avgMinutes);

          return (
            <FigureStat
              key={body.bodyTypeId}
              label={body.bodyTypeName}
              help={bodyTypeHelp(body.bodyTypeName)}
              value={figure.value}
              unit={figure.unit}
              detail={`promedio de ${plural(body.timedCount, 'lavado medido', 'lavados medidos')}`}
            />
          );
        })}
      </StatGrid>

      {selected === undefined ? null : (
        <PerformanceCard
          title="Cuánto tarda cada uno"
          aside={
            <BodyTypePicker
              bodies={bodies}
              value={selected.bodyTypeId}
              onChange={(bodyTypeId) => setChosen(bodyTypeId)}
            />
          }
        >
          {bars.length > 0 ? (
            <PerformanceBars
              rows={bars}
              average={teamAverage}
              averageLabel={`Promedio del equipo: ${formatMinutes(teamAverage)}`}
            />
          ) : (
            <EmptyState
              title={`Sin ${selected.bodyTypeName.toLowerCase()} medidos`}
              description="Cuando se laven carros de este tipo pasando por «Lavando», acá aparece cuánto tarda cada empleado."
            />
          )}
        </PerformanceCard>
      )}

      {team.untimedCount > 0 ? (
        <Note>
          {plural(team.untimedCount, 'lavado quedó', 'lavados quedaron')} sin tiempo: la oficina los
          pasó a Listo sin marcar «Lavando». No entran al promedio.
        </Note>
      ) : null}

      <PerformanceCard
        title="Por tipo de vehículo"
        aside={<Note>Entre paréntesis, lavados medidos</Note>}
      >
        <DataTable
          rows={people}
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
            ...bodies.map((body) => ({
              key: `body-${body.bodyTypeId}`,
              header: body.bodyTypeName,
              align: 'right' as const,
              cell: (row: PerformanceEmployeeRow) => {
                const mine = bodyOf(row.byBodyType, body.bodyTypeId);
                if (mine === undefined || mine.avgMinutes === null) {
                  return <span className="text-text-faint">—</span>;
                }

                return (
                  <span className="whitespace-nowrap">
                    {formatMinutes(mine.avgMinutes)}{' '}
                    <span className="text-text-faint text-dense">({mine.timedCount})</span>
                  </span>
                );
              },
            })),
            {
              key: 'versus',
              header: 'vs promedio',
              align: 'right',
              help: PERFORMANCE_HELP.timeVsTeam,
              cell: (row) => <Toned delta={minutesDelta(row.minutesVsTeam, true)} />,
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

/** Tiempos de un empleado: su promedio por tipo contra el equipo y cada lavado. */
export function EmployeeTimes({
  detail,
  onPageChange,
}: {
  detail: PerformanceEmployeeDetail;
  /** La lista de lavados pagina en el servidor (102). */
  onPageChange: (page: number) => void;
}) {
  const mine = detail.figures;

  if (mine.washCount === 0) {
    const empty = noWashesForEmployee(detail.employee.fullName);

    return <EmptyState title={empty.title} description={empty.description} />;
  }

  return (
    <div className="flex flex-col gap-(--grid-gap)">
      <StatGrid>
        {mine.byBodyType.map((body) => {
          const team = bodyOf(detail.team.byBodyType, body.bodyTypeId);
          const figure = minutesFigure(body.avgMinutes);
          const teamAverage = team?.avgMinutes ?? null;

          return (
            <FigureStat
              key={body.bodyTypeId}
              label={body.bodyTypeName}
              help={bodyTypeHelp(body.bodyTypeName)}
              value={figure.value}
              unit={figure.unit}
              detail={
                body.avgMinutes === null ? (
                  'sin lavados medidos'
                ) : (
                  <>
                    equipo {formatMinutes(teamAverage)}
                    {teamAverage === null ? null : (
                      <>
                        {' · '}
                        <Toned delta={minutesDelta(body.avgMinutes - teamAverage, true)} />
                      </>
                    )}
                    <br />
                    {plural(body.timedCount, 'lavado medido', 'lavados medidos')}
                  </>
                )
              }
            />
          );
        })}
      </StatGrid>

      {mine.untimedCount > 0 ? (
        <Note>
          {plural(mine.untimedCount, 'lavado suyo quedó', 'lavados suyos quedaron')} sin tiempo
          porque la oficina los pasó a Listo sin «Lavando». No cuentan ni a favor ni en contra.
        </Note>
      ) : null}

      <DataTable
        rows={detail.washes.items}
        rowKey={(wash) => wash.workOrderId}
        reference={(wash) => referenceOf(wash.ticketNumber)}
        rowHref={(wash) => `/carwash/${wash.workOrderId}`}
        emptyMessage="Cuando cobre lavados en estas fechas, acá aparece cuánto tardó en cada uno."
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
            key: 'service',
            header: 'Servicio',
            className: 'whitespace-normal',
            cell: (wash) => <span className="text-text-dim">{wash.mainServiceName ?? '—'}</span>,
          },
          {
            key: 'minutes',
            header: 'Tiempo',
            align: 'right',
            cell: (wash) =>
              wash.minutes === null ? (
                <span
                  className="text-text-faint"
                  title="La oficina lo pasó a Listo sin marcar Lavando"
                >
                  Sin tiempo
                </span>
              ) : (
                <b className="font-semibold">{formatMinutes(wash.minutes)}</b>
              ),
          },
          {
            key: 'versus',
            header: 'vs promedio',
            align: 'right',
            help: PERFORMANCE_HELP.washVsTeam,
            cell: (wash) =>
              wash.minutes === null ? (
                <span className="text-text-faint">—</span>
              ) : (
                <Toned delta={minutesDelta(wash.minutesVsTeam, true)} />
              ),
          },
        ]}
      />

      <Pager
        page={detail.washes}
        noun={{ one: 'lavado', many: 'lavados' }}
        onPageChange={onPageChange}
      />
    </div>
  );
}

/**
 * El tipo de carro de las barras: un `radiogroup` de verdad, navegable con
 * flechas (DESIGN.md → Accesibilidad), con cada opción del alto táctil.
 */
function BodyTypePicker({
  bodies,
  value,
  onChange,
}: {
  bodies: readonly PerformanceBodyTime[];
  value: string;
  onChange: (bodyTypeId: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = bodies.findIndex((body) => body.bodyTypeId === value);
    if (index < 0) return;
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;

    event.preventDefault();
    const next = bodies[(index + step + bodies.length) % bodies.length];
    if (next === undefined) return;
    onChange(next.bodyTypeId);
    refs.current.get(next.bodyTypeId)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tipo de vehículo"
      onKeyDown={onKeyDown}
      className="border-line bg-surface-2 inline-flex flex-wrap gap-0.75 rounded-control border p-0.75 max-sm:w-full"
    >
      {bodies.map((body) => {
        const checked = body.bodyTypeId === value;

        return (
          <button
            key={body.bodyTypeId}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            ref={(node) => {
              if (node === null) refs.current.delete(body.bodyTypeId);
              else refs.current.set(body.bodyTypeId, node);
            }}
            onClick={() => onChange(body.bodyTypeId)}
            className={cn(
              'min-h-[max(var(--touch-min),calc(var(--control-h)_-_8px))] rounded-(--segment-radius) border px-3 text-(length:--control-text-size) font-semibold transition-colors duration-(--duration-state) ease-standard max-sm:flex-1 [[data-density=bahia]_&]:px-4 [[data-density=bahia]_&]:text-body',
              checked
                ? 'bg-surface border-line text-text'
                : 'text-text-faint hover:text-text border-transparent',
            )}
          >
            {body.bodyTypeName}
          </button>
        );
      })}
    </div>
  );
}
