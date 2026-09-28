'use client';

import { PERMISSIONS } from '@elite/shared';
import { ChevronLeft, Pencil } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { DateRangeField } from '@/components/ui/date-field';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { EmployeeDialog } from '@/features/employees/components/employee-dialog';
import { useEmployees } from '@/features/employees/hooks/use-employees';
import type { CivilRange } from '@/lib/civil-date';
import { RANGE_END_PARAM, RANGE_START_PARAM } from '../../commission-range';
import { useEmployeePerformance, usePerformance } from '../../hooks/use-performance';
import { useCommissions } from '../../hooks/use-tickets';
import {
  EMPLOYEE_PARAM,
  PERFORMANCE_TABS,
  PERFORMANCE_TAB_LABELS,
  TAB_PARAM,
  performanceHref,
  performanceQuery,
  performanceViewFrom,
  plural,
  rangeLabel,
  type PerformanceTab,
  type PerformanceView,
} from '../../performance';
import { CommissionsReport } from '../commissions-screen';
import { EmployeeCommissionsDetail } from '../employee-commissions-screen';
import { EmployeeExtras, TeamExtras } from './performance-extras';
import { EmployeeLoyalty, TeamLoyalty } from './performance-loyalty';
import { PanelStatus } from './performance-parts';
import { EmployeeSummary, TeamSummary } from './performance-summary';
import { EmployeeTimes, TeamTimes } from './performance-times';

const TAB_ITEMS = PERFORMANCE_TABS.map((value) => ({
  value,
  label: PERFORMANCE_TAB_LABELS[value],
}));

/** El valor del selector «Ver» que significa todo el equipo. */
const TEAM_OPTION = '';

/**
 * Rendimiento (spec 067): comisiones, tiempos, extras y clientes fieles, de
 * todo el equipo o de un empleado.
 *
 * Pestaña, empleado y rango viven en la URL y se escriben con la API de
 * historial, que Next sincroniza con `useSearchParams`: sobreviven a la recarga
 * y el origen que anota una fila al abrir un lavado (056) los lleva puestos,
 * así que volver cae acá tal cual. Elegir un empleado apila una entrada —el
 * «atrás» del navegador vuelve al equipo—; pestaña y rango la reemplazan.
 */
export function PerformanceScreen() {
  const searchParams = useSearchParams();
  const view = useMemo(
    () =>
      performanceViewFrom({
        tab: searchParams.get(TAB_PARAM),
        employee: searchParams.get(EMPLOYEE_PARAM),
        start: searchParams.get(RANGE_START_PARAM),
        end: searchParams.get(RANGE_END_PARAM),
      }),
    [searchParams],
  );
  const { tab, employeeId, range } = view;
  const controlsRef = useRef<HTMLDivElement>(null);
  const { can } = usePermissions();
  const canManageEmployees = can(PERMISSIONS.employees.actions.manage.key);
  const employees = useEmployees(canManageEmployees);
  // La ficha se edita acá mismo, con el diálogo de Empleados: sin salir de Rendimiento.
  const editableEmployee =
    employeeId === null ? undefined : employees.data?.find((row) => row.id === employeeId);
  const [editingEmployee, setEditingEmployee] = useState(false);

  const navigate = useCallback((next: PerformanceView, mode: 'push' | 'replace') => {
    const href = performanceHref(next);
    if (mode === 'push') window.history.pushState(null, '', href);
    else window.history.replaceState(null, '', href);
  }, []);

  // La URL queda escrita entera desde el primer render: el origen que se anota
  // al abrir un lavado tiene que traer el rango aunque se haya entrado sin él.
  useEffect(() => {
    if (window.location.search.slice(1) !== performanceQuery(view)) navigate(view, 'replace');
  }, [view, navigate]);

  const setScope = useCallback(
    (next: string | null) => {
      if (next === employeeId) return;
      navigate({ ...view, employeeId: next }, 'push');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controlsRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      });
    },
    [employeeId, navigate, view],
  );
  const setTab = (next: PerformanceTab) => navigate({ ...view, tab: next }, 'replace');
  const setRange = (next: CivilRange) => navigate({ ...view, range: next }, 'replace');

  const report = usePerformance(range);
  const detail = useEmployeePerformance(employeeId, range, tab !== 'commissions');
  const commissions = useCommissions(
    { from: range.from, to: range.to },
    tab === 'commissions' && employeeId === null,
  );

  const data = report.data;
  const known = data?.activeEmployees.find((employee) => employee.id === employeeId);
  const options = useMemo<ComboboxOption[]>(() => {
    const list: ComboboxOption[] = [
      { value: TEAM_OPTION, label: 'Todo el equipo' },
      ...(data?.activeEmployees ?? []).map((employee) => ({
        value: employee.id,
        label: employee.fullName,
      })),
    ];
    // Un enlace viejo de Comisiones puede traer a un inactivo: se nombra, no se inventa.
    if (employeeId !== null && data !== undefined && known === undefined) {
      list.push({ value: employeeId, label: 'Empleado inactivo' });
    }

    return list;
  }, [data, employeeId, known]);

  const washCount = useMemo(() => {
    if (data === undefined) return null;
    if (employeeId !== null) {
      return data.employees.find((row) => row.employeeId === employeeId)?.washCount ?? 0;
    }
    // Comisiones cuenta también los lavados de inactivos, que se les deben (067 RN-8).
    if (tab === 'commissions' && commissions.data !== undefined) {
      return commissions.data.employees.reduce((total, row) => total + row.ticketCount, 0);
    }

    return data.team.washCount;
  }, [commissions.data, data, employeeId, tab]);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Rendimiento"
        subtitle="Comisiones, tiempos, extras y clientes fieles. De todo el equipo o de un empleado."
      />

      <div ref={controlsRef} className="flex scroll-mt-4 flex-wrap items-stretch gap-x-4 gap-y-3">
        <div className="flex w-full items-stretch gap-2.5 sm:w-auto">
          {employeeId === null ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setScope(null)}
              className="h-auto! shrink-0 self-stretch pr-3 pl-2"
            >
              <ChevronLeft strokeWidth={1.5} aria-hidden />
              Todo el equipo
            </Button>
          )}
          <Combobox
            label="Ver"
            options={options}
            value={employeeId ?? TEAM_OPTION}
            onChange={(value) => setScope(value === TEAM_OPTION ? null : value)}
            className="min-w-0 flex-1 sm:w-[280px] sm:flex-none"
          />
        </div>
        <DateRangeField value={range} onChange={setRange} aria-label="Rango de rendimiento" />
        {editableEmployee !== undefined ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditingEmployee(true)}
            className="h-auto! self-stretch max-sm:w-full sm:ml-auto"
          >
            <Pencil strokeWidth={1.5} aria-hidden />
            Editar empleado
          </Button>
        ) : null}
      </div>

      {editableEmployee !== undefined ? (
        <EmployeeDialog
          key={editableEmployee.id}
          employee={editableEmployee}
          readOnly={false}
          open={editingEmployee}
          onOpenChange={setEditingEmployee}
        />
      ) : null}

      <p className="text-text-dim -mt-1.5 text-body tabular-nums" aria-live="polite">
        {rangeLabel(range.from, range.to)}
        {washCount === null
          ? null
          : ` · ${plural(washCount, 'lavado cobrado', 'lavados cobrados')}`}
      </p>

      <Tabs
        aria-label="Indicador"
        value={tab}
        onValueChange={setTab}
        items={TAB_ITEMS}
        className="[[data-density=bahia]_&]:[&_[role=tab]]:px-[18px] [[data-density=bahia]_&]:[&_[role=tab]]:text-[16px]"
      />

      <section role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <Panel
          view={view}
          report={report}
          detail={detail}
          onSelectEmployee={(id) => setScope(id)}
        />
      </section>
    </div>
  );
}

function Panel({
  view,
  report,
  detail,
  onSelectEmployee,
}: {
  view: PerformanceView;
  report: ReturnType<typeof usePerformance>;
  detail: ReturnType<typeof useEmployeePerformance>;
  onSelectEmployee: (employeeId: string) => void;
}) {
  const { tab, employeeId, range } = view;

  // Comisiones no depende del reporte de Rendimiento: es la 009/061 tal cual.
  if (tab === 'commissions') {
    return employeeId === null ? (
      <CommissionsReport range={range} onSelectEmployee={onSelectEmployee} />
    ) : (
      <EmployeeCommissionsDetail employeeId={employeeId} range={range} />
    );
  }

  if (employeeId !== null) {
    if (detail.data === undefined) return <PanelStatus error={detail.error?.message ?? null} />;
    if (tab === 'summary') return <EmployeeSummary detail={detail.data} />;
    if (tab === 'times') return <EmployeeTimes detail={detail.data} />;
    if (tab === 'extras') return <EmployeeExtras detail={detail.data} />;
    return <EmployeeLoyalty detail={detail.data} />;
  }

  if (report.data === undefined) return <PanelStatus error={report.error?.message ?? null} />;
  if (tab === 'summary') {
    return <TeamSummary report={report.data} onSelectEmployee={onSelectEmployee} />;
  }
  if (tab === 'times') {
    return <TeamTimes report={report.data} onSelectEmployee={onSelectEmployee} />;
  }
  if (tab === 'extras') {
    return <TeamExtras report={report.data} onSelectEmployee={onSelectEmployee} />;
  }

  return <TeamLoyalty report={report.data} onSelectEmployee={onSelectEmployee} />;
}
