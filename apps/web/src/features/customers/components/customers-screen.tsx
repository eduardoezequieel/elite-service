'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Customer } from '@elite/shared';
import { ArrowRight, Pencil, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { useCustomers } from '../hooks/use-customers';
import { CustomerDialog } from './customer-dialog';

/** «12 clientes activos», o «12 activos · 2 inactivos» cuando hay de los dos. */
function countsLabel(customers: readonly Customer[]): string {
  const active = customers.filter((customer) => customer.isActive).length;
  const inactive = customers.length - active;

  if (inactive === 0) {
    return active === 1 ? '1 cliente activo' : `${active} clientes activos`;
  }

  return `${active} ${active === 1 ? 'activo' : 'activos'} · ${inactive} ${
    inactive === 1 ? 'inactivo' : 'inactivos'
  }`;
}

/**
 * Clientes, desde la oficina (004).
 *
 * Los clientes existían en la base desde el primer lavado pero no en la
 * aplicación: esta es la pantalla donde se los encuentra, se los corrige y se
 * ve qué carros tienen.
 *
 * La lista pide `activeOnly=false` a propósito: es el único sitio del sistema
 * donde un cliente dado de baja se vuelve a ver, que es lo que hace falta para
 * reactivarlo (RN-4). En la ficha de un lavado nunca se ofrece.
 */
export function CustomersScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.customers.actions.read.key);
  const canManage = can(PERMISSIONS.customers.actions.manage.key);

  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());

  // Dos consultas que son la misma mientras no se busque nada: la de abajo
  // alimenta la lista y la de arriba el recuento del subtítulo, que no debe
  // cambiar al filtrar.
  const customers = useCustomers(
    { q: search === '' ? undefined : search, activeOnly: false },
    canRead,
  );
  const all = useCustomers({ activeOnly: false }, canRead);

  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);

  const newCustomerButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nuevo cliente
    </Button>
  ) : null;

  const searching = search !== '';

  return (
    <div className="flex flex-col gap-5">
      {/* El renglón del recuento se reserva aunque todavía no esté: el título
          no salta de sitio cuando la lista llega. */}
      <ScreenHeader title="Clientes" subtitle={all.data ? countsLabel(all.data) : '\u00a0'}>
        {newCustomerButton}
      </ScreenHeader>

      <div className="grid max-w-md gap-1.5">
        <Label htmlFor="customer-search">Buscar por nombre o teléfono</Label>
        <div className="relative">
          <Search
            className="text-text-faint pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2"
            strokeWidth={1.5}
            aria-hidden
          />
          <Input
            id="customer-search"
            className="pl-10"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Juan Pérez o 7777-8888"
            autoComplete="off"
          />
        </div>
      </div>

      <DataTable
        rows={customers.data ?? []}
        rowKey={(customer) => customer.id}
        isLoading={customers.isPending}
        errorMessage={customers.error?.message ?? null}
        emptyTitle={searching ? `Nadie coincide con «${search}»` : 'Todavía no hay clientes'}
        emptyMessage={
          searching
            ? 'Probá con otra parte del nombre o con el teléfono.'
            : 'Los clientes se crean solos al anotar un lavado, o acá con «Nuevo cliente».'
        }
        emptyAction={searching ? undefined : (newCustomerButton ?? undefined)}
        columns={[
          {
            key: 'name',
            header: 'Nombre',
            stack: 'title',
            cell: (customer) => (
              <span className={cn('text-body font-semibold', !customer.isActive && 'is-ruled-out')}>
                {customer.fullName}
              </span>
            ),
          },
          {
            key: 'phone',
            header: 'Teléfono',
            cell: (customer) => (
              <span className="text-text-dim font-mono text-dense">
                {customer.phone?.trim() || '—'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            cell: (customer) =>
              customer.isActive ? (
                <Stamp tone="green" label="Activo" />
              ) : (
                <Stamp tone="neutral" label="Inactivo" />
              ),
          },
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions',
            cell: (customer) => (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/customers/${customer.id}`}>
                    <ArrowRight
                      className="text-text-faint size-3.5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    Abrir
                    <span className="sr-only"> la ficha de {customer.fullName}</span>
                  </Link>
                </Button>

                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(customer)}
                  >
                    <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
                    Editar
                    <span className="sr-only"> a {customer.fullName}</span>
                  </Button>
                ) : null}
              </>
            ),
          },
        ]}
      />

      <CustomerDialog
        customer={editing}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}
