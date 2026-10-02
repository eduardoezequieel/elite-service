'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Customer, VehicleWithOwner } from '@elite/shared';
import { Pencil } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { statusLabel, TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { ticketFilterParams, withAllOption } from '@/lib/list-filters';
import { LIST_PAGE_SIZE, pageParam } from '@/lib/list-params';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { useTickets } from '@/features/carwash/hooks/use-tickets';
import { useUrlPage } from '@/features/carwash/hooks/use-url-page';
import { referenceOf } from '@/features/carwash/reference';
import { useCustomer, useCustomerVehicles } from '../hooks/use-customers';
import { CustomerDialog } from './customer-dialog';
import { VehicleDialog } from './vehicle-dialog';
import { DetailSkeleton } from '@/components/ui/skeleton';

const TICKET_STATUS_OPTIONS = withAllOption('Todos los estados', [
  { value: 'OPEN', label: statusLabel('OPEN') },
  { value: 'WASHING', label: statusLabel('WASHING') },
  { value: 'READY', label: statusLabel('READY') },
  { value: 'PAID', label: statusLabel('PAID') },
  { value: 'VOID', label: statusLabel('VOID') },
]);

/** La página de los carros en la URL (102), al lado de la `page` del historial. */
const VEHICLES_PAGE_PARAM = 'vehiclesPage';

const DATE_FORMAT = new Intl.DateTimeFormat('es-SV', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * La ficha de un cliente: sus datos, sus carros y sus lavados (004).
 *
 * Las dos láminas de abajo dependen de permisos distintos —`vehicles.read` y
 * `carwash.read`—: sin uno de ellos la lámina no se dibuja, no se dibuja vacía.
 * Oculto dice «esto no es tuyo»; una lámina vacía diría «este cliente no tiene
 * carros», que sería mentira.
 */
export function CustomerDetailScreen({ id }: { id: string }) {
  const { can } = usePermissions();
  const customer = useCustomer(id, can(PERMISSIONS.customers.actions.read.key));

  if (customer.isPending) {
    return <DetailSkeleton label="Cargando el cliente" />;
  }

  if (customer.error !== null || customer.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {customer.error?.message ?? 'No se pudo cargar el cliente.'}
      </p>
    );
  }

  return <CustomerDetail customer={customer.data} />;
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.customers.actions.manage.key);
  const canSeeVehicles = can(PERMISSIONS.vehicles.actions.read.key);
  const canManageVehicles = can(PERMISSIONS.vehicles.actions.manage.key);
  const canSeeTickets = can(PERMISSIONS.carwash.actions.read.key);

  const searchParams = useSearchParams();
  const [vehiclesPage, setVehiclesPage] = useUrlPage(
    VEHICLES_PAGE_PARAM,
    pageParam(searchParams.get(VEHICLES_PAGE_PARAM)),
  );
  const vehicles = useCustomerVehicles(customer.id, vehiclesPage, canSeeVehicles);
  const extra = useFilterValues(['status'] as const);
  // El historial pagina en el servidor (102) y vuelve a 1 al cambiar el estado.
  const [ticketsPage, setTicketsPage] = useListPage(
    pageParam(searchParams.get('page')),
    extra.values.status,
  );
  const tickets = useTickets(
    {
      customerId: customer.id,
      status: ticketFilterParams(extra.values).status,
      page: ticketsPage,
      pageSize: LIST_PAGE_SIZE,
    },
    canSeeTickets,
  );
  const ticketRows = tickets.data?.items ?? [];
  // Cuántos lavados tiene en total, sin el recorte del estado.
  const historyCount = tickets.data?.summary.all ?? 0;
  const [editing, setEditing] = useState(false);
  const [vehicleDialog, setVehicleDialog] = useState<VehicleWithOwner | 'new' | null>(null);
  const rows = vehicles.data?.items ?? [];
  const vehicleCount = vehicles.data?.total ?? 0;
  const newVehicle = canManageVehicles ? (
    <Button type="button" onClick={() => setVehicleDialog('new')}>
      Nuevo carro
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={customer.fullName}
        subtitle={<span className="font-mono">{customer.phone?.trim() || 'Sin teléfono'}</span>}
      >
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
            Editar
          </Button>
        ) : null}
      </ScreenHeader>

      {canSeeVehicles ? (
        <Card className="gap-3 px-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-title text-text">Carros</h2>
            {vehicleCount > 0 ? newVehicle : null}
          </div>

          <DataTable
            rows={rows}
            rowKey={(vehicle) => vehicle.id}
            reference={(_vehicle, index) => pagedReference(vehicles.data, index)}
            isLoading={vehicles.isPending}
            errorMessage={vehicles.error?.message ?? null}
            emptyTitle="Sin carros anotados"
            emptyMessage="Este cliente todavía no tiene carros anotados."
            emptyAction={vehicleCount === 0 ? newVehicle : undefined}
            columns={[
              {
                key: 'plate',
                header: 'Placa',
                stack: 'title',
                className: 'whitespace-nowrap',
                cell: (vehicle) => <PlateChip plate={vehicle.plate} />,
              },
              {
                key: 'bodyType',
                header: 'Tipo',
                className: 'whitespace-nowrap',
                cell: (vehicle) => <span className="text-text-dim">{vehicle.bodyType.name}</span>,
              },
              {
                key: 'details',
                header: 'Marca y color',
                headerClassName: 'w-full',
                cell: (vehicle) => (
                  <span className="text-text-dim">
                    {[vehicle.make, vehicle.color].filter(Boolean).join(' · ') || '—'}
                  </span>
                ),
              },
              ...(canManageVehicles
                ? [
                    {
                      key: 'actions',
                      header: 'Acciones',
                      stack: 'actions' as const,
                      className: 'whitespace-nowrap',
                      cell: (vehicle: VehicleWithOwner) => (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setVehicleDialog(vehicle)}
                        >
                          <Pencil
                            className="size-3.5 text-text-faint"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          Editar
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          <Pager
            page={vehicles.data}
            noun={{ one: 'carro', many: 'carros' }}
            onPageChange={setVehiclesPage}
          />
        </Card>
      ) : null}

      {canSeeTickets ? (
        <Card className="gap-3 px-card">
          <h2 className="text-title text-text">Lavados</h2>

          <FilterBar>
            <FiltersPopover
              fields={[
                {
                  id: 'status',
                  label: 'Estado',
                  value: extra.values.status,
                  options: TICKET_STATUS_OPTIONS,
                  onChange: (value) => extra.set('status', value),
                },
              ]}
              onReset={extra.reset}
            />
          </FilterBar>

          <DataTable
            rows={ticketRows}
            rowKey={(ticket) => ticket.id}
            rowHref={(ticket) => `/carwash/${ticket.id}`}
            // El lavado tiene folio propio: es el mismo número en la pista, en
            // el mostrador y en el papel del cliente (003 RN-15).
            reference={(ticket) => referenceOf(ticket.number)}
            isLoading={tickets.isPending}
            errorMessage={tickets.error?.message ?? null}
            emptyTitle={historyCount > 0 ? 'Ningún lavado coincide' : 'Sin lavados todavía'}
            emptyMessage={
              historyCount > 0
                ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
                : 'Este cliente todavía no tiene lavados. Cuando entre su carro va a aparecer acá.'
            }
            columns={[
              {
                key: 'date',
                header: 'Fecha',
                stack: 'title',
                headerClassName: 'w-full',
                cell: (ticket) => (
                  <span className="text-body">
                    {DATE_FORMAT.format(new Date(ticket.createdAt))}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Estado',
                stack: 'aside',
                className: 'whitespace-nowrap',
                cell: (ticket) => <TicketStatusStamp status={ticket.status} />,
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                className: 'whitespace-nowrap',
                cell: (ticket) => (
                  <span className="text-text font-mono font-semibold">${ticket.total}</span>
                ),
              },
            ]}
          />

          <Pager
            page={tickets.data}
            noun={{ one: 'lavado', many: 'lavados' }}
            onPageChange={setTicketsPage}
          />
        </Card>
      ) : null}

      <CustomerDialog customer={customer} open={editing} onOpenChange={setEditing} />
      {vehicleDialog === null ? null : (
        <VehicleDialog
          customerId={customer.id}
          vehicle={vehicleDialog === 'new' ? null : vehicleDialog}
          onClose={() => setVehicleDialog(null)}
        />
      )}
    </div>
  );
}
