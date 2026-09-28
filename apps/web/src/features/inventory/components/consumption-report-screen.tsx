'use client';

import type { EmployeeConsumptionRow } from '@elite/shared';
import { useEffect, useState } from 'react';

import { DataTable } from '@/components/ui/data-table';
import { DateRangeField } from '@/components/ui/date-field';
import { FilterBar } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { rangeSummary, type CivilRange } from '@/lib/civil-date';
import { replaceQuery } from '@/lib/list-params';
import { formatMoney, moneyParts } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { consumptionDetailHref, consumptionRangeQuery } from '../consumption';
import { useEmployeeConsumptionReport } from '../hooks/use-inventory';
import { InventoryFrame } from './inventory-frame';

/**
 * `/inventory/consumption` → Consumos del personal (070, rango de la 091):
 * cuánto tomó cada trabajador en las fechas elegidas, en unidades y a precio
 * de venta, de mayor a menor. Es informativo (RN-7): no descuenta nada.
 *
 * Las fechas son el `DateRangeField` de siempre y viven en la URL
 * (`?start=&end=`), así que el detalle que se abre desde una fila vuelve a
 * este mismo rango (056).
 */
export function ConsumptionReportScreen({ initialRange }: { initialRange: CivilRange }) {
  const [range, setRange] = useState<CivilRange>(initialRange);
  const report = useEmployeeConsumptionReport(range);
  const data = report.data;
  // Con `keepPreviousData` la tabla muestra el rango anterior mientras llega el
  // nuevo; la cifra no puede decir que es de unas fechas que no son.
  const current =
    data !== undefined && data.from === range.from && data.to === range.to ? data : undefined;
  const total = moneyParts(current?.total ?? '0.00');

  useEffect(() => {
    replaceQuery(consumptionRangeQuery(range));
  }, [range]);

  return (
    <InventoryFrame section="consumption">
      <div className="flex flex-col gap-5">
        <FilterBar>
          <DateRangeField value={range} onChange={setRange} aria-label="Rango de consumos" />
        </FilterBar>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={`Total · ${rangeSummary(range)}`}
            value={current === undefined ? '—' : total.whole}
            unit={current === undefined ? undefined : total.fraction}
            detail={
              current === undefined
                ? undefined
                : `${current.rows.length} ${current.rows.length === 1 ? 'trabajador' : 'trabajadores'}`
            }
          />
        </div>

        <p className="text-text-dim text-dense [[data-density=bahia]_&]:text-body">
          Lo que cada trabajador tomó, a precio de venta. Es para llevar la cuenta: no se cobra ni
          se descuenta. Para anular uno, entrá al trabajador.
        </p>

        <DataTable<EmployeeConsumptionRow>
          rows={data?.rows ?? []}
          rowKey={(row) => row.employee.id}
          rowHref={(row) => consumptionDetailHref(row.employee.id, range)}
          isLoading={report.isPending}
          errorMessage={report.error?.message ?? null}
          emptyTitle="Nadie anotó consumos en estas fechas"
          emptyMessage="Cuando se le entregue un producto a un trabajador, acá sale su total."
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
    </InventoryFrame>
  );
}
