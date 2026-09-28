'use client';

import type { EmployeeConsumptionRow } from '@elite/shared';
import { useEffect, useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { replaceQuery } from '@/lib/list-params';
import { formatMoney, moneyParts } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import {
  consumptionDetailHref,
  consumptionMonthQuery,
  consumptionMonthTitle,
  type ConsumptionMonth,
} from '../consumption';
import { useEmployeeConsumptionReport } from '../hooks/use-inventory';
import { ConsumptionMonthStepper } from './consumption-month-stepper';

/**
 * `/inventory/consumption` (spec 070): cuánto tomó cada trabajador en el mes,
 * en unidades y a precio de venta, de mayor a menor. Es informativo (RN-7): no
 * descuenta nada; el dueño lo usa por fuera.
 *
 * El mes vive en la URL (`?month=`), así que el detalle que se abre desde una
 * fila vuelve a este mismo mes (056).
 */
export function ConsumptionReportScreen({ initialMonth }: { initialMonth: ConsumptionMonth }) {
  const [month, setMonth] = useState<ConsumptionMonth>(initialMonth);
  const report = useEmployeeConsumptionReport(month);
  const data = report.data;
  // Con `keepPreviousData` la tabla muestra el mes anterior mientras llega el
  // nuevo; la cifra no puede decir que es de un mes que no es.
  const current = data !== undefined && data.month === month ? data : undefined;
  const total = moneyParts(current?.total ?? '0.00');

  useEffect(() => {
    replaceQuery(consumptionMonthQuery(month));
  }, [month]);

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Consumo de empleados"
        subtitle="Lo que cada trabajador tomó del inventario, a precio de venta. No se cobra: queda anotado."
      />

      <FilterBar>
        <ConsumptionMonthStepper month={month} onChange={setMonth} />
      </FilterBar>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`Total de ${consumptionMonthTitle(month).toLocaleLowerCase('es-SV')}`}
          value={current === undefined ? '—' : total.whole}
          unit={current === undefined ? undefined : total.fraction}
          detail={
            current === undefined
              ? undefined
              : `${current.rows.length} ${current.rows.length === 1 ? 'trabajador' : 'trabajadores'}`
          }
        />
      </div>

      <DataTable<EmployeeConsumptionRow>
        rows={data?.rows ?? []}
        rowKey={(row) => row.employee.id}
        rowHref={(row) => consumptionDetailHref(row.employee.id, month)}
        isLoading={report.isPending}
        errorMessage={report.error?.message ?? null}
        emptyTitle={`Nadie anotó consumos en ${consumptionMonthTitle(month).toLocaleLowerCase('es-SV')}`}
        emptyMessage="Cuando la oficina anote lo que toma un trabajador, acá va a salir su total del mes."
        columns={[
          {
            key: 'name',
            header: 'Empleado',
            headerClassName: 'w-full',
            stack: 'title',
            className: 'whitespace-normal',
            cell: (row) => (
              <span className="text-text text-body font-semibold">{row.employee.fullName}</span>
            ),
          },
          {
            key: 'units',
            header: 'Unidades',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (row) => (
              <span className="text-text font-mono [[data-density=bahia]_&]:text-body">
                {formatQuantity(row.units)}
              </span>
            ),
          },
          {
            key: 'total',
            header: 'Valor',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (row) => (
              <span className="text-text font-mono font-semibold [[data-density=bahia]_&]:text-body">
                {formatMoney(row.total)}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (row) =>
              row.employee.isActive ? null : <Stamp tone="neutral" label="Inactivo" />,
          },
        ]}
      />
    </div>
  );
}
