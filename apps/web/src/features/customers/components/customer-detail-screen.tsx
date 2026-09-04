'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Customer, VehicleWithOwner } from '@elite/shared';
import { ArrowRight, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DeactivateConfirmDialog } from '@/components/ui/deactivate-confirm-dialog';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { PlateChip } from '@/components/ui/plate-chip';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { useTickets } from '@/features/carwash/hooks/use-tickets';
import { referenceOf } from '@/features/carwash/reference';
import { useCustomer, useCustomerVehicles, useUpdateCustomer } from '../hooks/use-customers';
import { CustomerDialog } from './customer-dialog';
import { VehicleDialog } from './vehicle-dialog';

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
    return <p className="text-text-dim text-body">Cargando…</p>;
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

  const vehicles = useCustomerVehicles(customer.id, canSeeVehicles);
  const tickets = useTickets({ customerId: customer.id }, canSeeTickets);
  const update = useUpdateCustomer();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [vehicleDialog, setVehicleDialog] = useState<VehicleWithOwner | 'new' | null>(null);
  const rows = vehicles.data ?? [];
  const newVehicle = canManageVehicles ? (
    <Button type="button" onClick={() => setVehicleDialog('new')}>
      Nuevo carro
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={customer.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono">{customer.phone?.trim() || 'Sin teléfono'}</span>
            {customer.isActive ? (
              <Stamp tone="queue" label="Activo" />
            ) : (
              <Stamp tone="neutral" label="Inactivo" />
            )}
          </span>
        }
      >
        {canManage ? (
          <>
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
              Editar
            </Button>

            <Button
              type="button"
              variant="outline"
              loading={update.isPending}
              onClick={() => {
                if (customer.isActive) {
                  update.reset();
                  setConfirmingDeactivate(true);
                  return;
                }

                update.mutate(
                  { id: customer.id, input: { isActive: true } },
                  {
                    onSuccess: () =>
                      toast({
                        title: 'Cliente reactivado',
                        description: customer.fullName,
                      }),
                  },
                );
              }}
            >
              {customer.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          </>
        ) : null}
      </ScreenHeader>

      {update.error ? (
        <p className="text-danger-text text-body" role="alert">
          {update.error.message}
        </p>
      ) : null}

      {canSeeVehicles ? (
        <Card className="gap-3 px-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-title text-text">Carros</h2>
            {rows.length > 0 ? newVehicle : null}
          </div>

          <DataTable
            rows={rows}
            rowKey={(vehicle) => vehicle.id}
            isLoading={vehicles.isPending}
            errorMessage={vehicles.error?.message ?? null}
            emptyTitle="Sin carros anotados"
            emptyMessage="Este cliente todavía no tiene carros anotados."
            emptyAction={rows.length === 0 ? newVehicle : undefined}
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
        </Card>
      ) : null}

      {canSeeTickets ? (
        <Card className="gap-3 px-card">
          <h2 className="text-title text-text">Lavados</h2>

          <DataTable
            rows={tickets.data ?? []}
            rowKey={(ticket) => ticket.id}
            // El lavado tiene folio propio: es el mismo número en la pista, en
            // el mostrador y en el papel del cliente (003 RN-15).
            reference={(ticket) => referenceOf(ticket.number)}
            isLoading={tickets.isPending}
            errorMessage={tickets.error?.message ?? null}
            emptyTitle="Sin lavados todavía"
            emptyMessage="Este cliente todavía no tiene lavados. Cuando entre su carro va a aparecer acá."
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
              {
                key: 'actions',
                header: 'Acciones',
                stack: 'actions',
                className: 'whitespace-nowrap',
                cell: (ticket) => (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/carwash/${ticket.id}`}>
                      <ArrowRight
                        className="text-text-faint size-3.5"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      Abrir
                      <span className="sr-only"> el lavado {ticket.number}</span>
                    </Link>
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      <DeactivateConfirmDialog
        open={confirmingDeactivate}
        onOpenChange={setConfirmingDeactivate}
        title={`¿Desactivar a ${customer.fullName}?`}
        description="Deja de sugerirse al anotar un lavado. Sus lavados viejos siguen siendo suyos."
        loading={update.isPending}
        error={update.error?.message ?? null}
        onConfirm={() =>
          update.mutate(
            { id: customer.id, input: { isActive: false } },
            {
              onSuccess: () => {
                toast({ title: 'Cliente desactivado', description: customer.fullName });
                setConfirmingDeactivate(false);
              },
            },
          )
        }
      />

      <CustomerDialog
        customer={editing ? customer : null}
        open={editing}
        onOpenChange={setEditing}
      />
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
