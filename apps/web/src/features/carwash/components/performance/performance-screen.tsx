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
import { LIST_PAGE_SIZE, pushQuery, replaceQuery } from '@/lib/list-params';
import { RANGE_END_PARAM, RANGE_START_PARAM } from '../../commission-range';
import { useEmployeePerformance, usePerformance } from '../../hooks/use-performance';
import { useCommissions } from '../../hooks/use-tickets';
import {
  EMPLOYEE_PARAM,
  PAGE_PARAM,
  PERFORMANCE_TABS,
  PERFORMANCE_TAB_LABELS,
  TAB_PARAM,
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
 * historial (`replaceQuery` / `pushQuery` de `lib/list-params`), que Next sincroniza con `useSearchParams`: sobreviven a la recarga
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
        page: searchParams.get(PAGE_PARAM),
      }),
    [searchParams],
  );
  const { tab, employeeId, range, page } = view;
  const controlsRef = useRef<HTMLDivElement>(null);
  const { can } = usePermissions();
  const canManageEmployees = can(PERMISSIONS.employees.actions.manage.key);
  const employees = useEmployees(canManageEmployees);
  // La ficha se edita acá mismo, con el diálogo de Empleados: sin salir de Rendimiento.
  const editableEmployee =
    employeeId === null ? undefined : employees.data?.find((row) => row.id === employeeId);
  const [editingEmployee, setEditingEmployee] = useState(false);

  const navigate = useCallback((next: PerformanceView, mode: 'push' | 'replace') => {
    const query = performanceQuery(next);
    if (mode === 'push') pushQuery(query);
    else replaceQuery(query);
  }, []);

  // La URL queda escrita entera: el origen que se anota al abrir un lavado
  // tiene que traer el rango aunque se haya entrado sin él. Si ya lo dice, no
  // se toca (`replaceQuery` compara antes de escribir).
  useEffect(() => {
    replaceQuery(performanceQuery(view));
  }, [view]);

  const setScope = useCallback(
    (next: string | null) => {
      if (next === employeeId) return;
      navigate({ ...view, employeeId: next, page: 1 }, 'push');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controlsRef.current?.scrollIntoView({
        block: 'nearest',
        behavior: reduced ? 'auto' : 'smooth',
      });
    },
    [employeeId, navigate, view],
  );
  // Otra pestaña, otro rango u otro empleado es otra tabla: vuelve a la página 1 (102).
  const setTab = (next: PerformanceTab) => navigate({ ...view, tab: next, page: 1 }, 'replace');
  const setRange = (next: CivilRange) => navigate({ ...view, range: next, page: 1 }, 'replace');
  const setPage = (next: number) => navigate({ ...view, page: next }, 'replace');

  // Cada pestaña muestra una sola tabla: la página va solo a la consulta que la llena.
  const report = usePerformance(range, employeeId === null && tab !== 'commissions' ? page : 1);
  // Con empleado elegido, el detalle también da el recuento de abajo del rango.
  const detail = useEmployeePerformance(employeeId, range, true, tab === 'commissions' ? 1 : page);
  const commissions = useCommissions(
    { from: range.from, to: range.to, page, pageSize: LIST_PAGE_SIZE },
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
    if (employeeId !== null) return detail.data?.figures.washCount ?? null;
    // Comisiones cuenta también los lavados de inactivos, que se les deben (067
    // RN-8). Solo se puede sumar si todas las filas caben en la página (102).
    const rows = commissions.data?.employees;
    if (tab === 'commissions' && rows !== undefined && rows.items.length === rows.total) {
      return rows.items.reduce((total, row) => total + row.ticketCount, 0);
    }

    return data.team.washCount;
  }, [commissions.data, data, detail.data, employeeId, tab]);

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
            className="min-w-0 flex-1 sm:w-70 sm:flex-none"
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
        className="[[data-density=bahia]_&]:[&_[role=tab]]:px-4.5 [[data-density=bahia]_&]:[&_[role=tab]]:text-(length:--lead-size)"
      />

      <section role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <Panel
          view={view}
          report={report}
          detail={detail}
          onSelectEmployee={(id) => setScope(id)}
          onPageChange={setPage}
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
  onPageChange,
}: {
  view: PerformanceView;
  report: ReturnType<typeof usePerformance>;
  detail: ReturnType<typeof useEmployeePerformance>;
  onSelectEmployee: (employeeId: string) => void;
  onPageChange: (page: number) => void;
}) {
  const { tab, employeeId, range, page } = view;

  // Comisiones no depende del reporte de Rendimiento: es la 009/061 tal cual.
  if (tab === 'commissions') {
    return employeeId === null ? (
      <CommissionsReport
        range={range}
        page={page}
        onPageChange={onPageChange}
        onSelectEmployee={onSelectEmployee}
      />
    ) : (
      <EmployeeCommissionsDetail
        employeeId={employeeId}
        range={range}
        page={page}
        onPageChange={onPageChange}
      />
    );
  }

  if (employeeId !== null) {
    if (detail.data === undefined) return <PanelStatus error={detail.error?.message ?? null} />;
    if (tab === 'summary') return <EmployeeSummary detail={detail.data} />;
    if (tab === 'times') return <EmployeeTimes detail={detail.data} onPageChange={onPageChange} />;
    if (tab === 'extras') {
      return <EmployeeExtras detail={detail.data} onPageChange={onPageChange} />;
    }
    return <EmployeeLoyalty detail={detail.data} onPageChange={onPageChange} />;
  }

  if (report.data === undefined) return <PanelStatus error={report.error?.message ?? null} />;
  if (tab === 'summary') {
    return (
      <TeamSummary
        report={report.data}
        onSelectEmployee={onSelectEmployee}
        onPageChange={onPageChange}
      />
    );
  }
  if (tab === 'times') {
    return (
      <TeamTimes
        report={report.data}
        onSelectEmployee={onSelectEmployee}
        onPageChange={onPageChange}
      />
    );
  }
  if (tab === 'extras') {
    return (
      <TeamExtras
        report={report.data}
        onSelectEmployee={onSelectEmployee}
        onPageChange={onPageChange}
      />
    );
  }

  return (
    <TeamLoyalty
      report={report.data}
      onSelectEmployee={onSelectEmployee}
      onPageChange={onPageChange}
    />
  );
}
