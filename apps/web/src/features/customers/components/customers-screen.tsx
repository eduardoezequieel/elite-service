'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Customer } from '@elite/shared';
import { Pencil, Search } from 'lucide-react';
import { useState } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCustomers } from '../hooks/use-customers';
import { CustomerDialog } from './customer-dialog';

/** «12 clientes», «1 cliente». */
function countsLabel(total: number): string {
  return total === 1 ? '1 cliente' : `${total} clientes`;
}

/**
 * Clientes, desde la oficina (004).
 *
 * Los clientes existían en la base desde el primer lavado pero no en la
 * aplicación: esta es la pantalla donde se los encuentra, se los corrige y se
 * ve qué carros tienen.
 *
 * No hay estado ni filtro de actividad: un cliente no se desactiva (048). Lo
 * único que recorta la lista es el buscador.
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
  const customers = useCustomers({ q: search === '' ? undefined : search }, canRead);
  const all = useCustomers({}, canRead);

  const [editing, setEditing] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);

  const newCustomerButton = canManage ? (
    <Button
      type="button"
      onClick={() => {
        setEditing(null);
        setOpen(true);
      }}
    >
      Nuevo cliente
    </Button>
  ) : null;

  const searching = search !== '';
  const rows = customers.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* El renglón del recuento se reserva aunque todavía no esté: el título
          no salta de sitio cuando la lista llega. */}
      <ScreenHeader title="Clientes" subtitle={all.data ? countsLabel(all.data.length) : '\u00a0'}>
        {(all.data?.length ?? 0) > 0 ? newCustomerButton : null}
      </ScreenHeader>

      <FilterBar>
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="customer-search">Buscar por nombre o teléfono</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="customer-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Juan Pérez o 7777-8888"
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
      </FilterBar>

      <DataTable
        rows={rows}
        rowKey={(customer) => customer.id}
        rowHref={(customer) => `/customers/${customer.id}`}
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
            headerClassName: 'w-full',
            stack: 'title',
            cell: (customer) => (
              <span className="text-body font-semibold">{customer.fullName}</span>
            ),
          },
          {
            key: 'phone',
            header: 'Teléfono',
            className: 'whitespace-nowrap',
            cell: (customer) => (
              <span className="text-text-dim font-mono text-dense">
                {customer.phone?.trim() || '—'}
              </span>
            ),
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (customer: Customer) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(customer);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="text-text-faint size-3.5" strokeWidth={1.5} aria-hidden />
                      Editar
                      <span className="sr-only"> a {customer.fullName}</span>
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      <CustomerDialog customer={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
