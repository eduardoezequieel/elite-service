'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Reference } from '@/components/ui/reference';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useTickets } from '../hooks/use-tickets';
import { TicketStatusStamp } from './ticket-status-stamp';

/** Los filtros de la fila. «Pendientes» es lo que el mostrador mira todo el día. */
const FILTERS = [
  { key: 'pending', label: 'Pendientes', status: 'OPEN,READY' },
  { key: 'ready', label: 'Listos para cobrar', status: 'READY' },
  { key: 'all', label: 'Todos', status: undefined },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

/**
 * `CW-0014` → `14`: el número como se dice en voz alta (RN-15).
 *
 * Si el folio no tiene la forma esperada devuelve 0 en vez de romper la fila:
 * una tabla que no carga por un dato raro es peor que una referencia rara.
 */
function referenceOf(number: string): number {
  const sequence = Number(number.slice(number.indexOf('-') + 1));

  return Number.isFinite(sequence) ? sequence : 0;
}

/**
 * La fila de lavados de **oficina**.
 *
 * Una pantalla, una acción principal (RN-17): entrar a un lavado. El cobro no
 * vive acá sino en el detalle, porque cobrar sin haber mirado qué se cobra es
 * justo el error que no se puede deshacer — un ticket `PAID` no vuelve.
 */
export function TicketsScreen() {
  const { can } = usePermissions();
  const [filter, setFilter] = useState<FilterKey>('pending');

  const status = useMemo(
    () => FILTERS.find((option) => option.key === filter)?.status,
    [filter],
  );
  const tickets = useTickets({ status });
  const canManage = can(PERMISSIONS.carwash.actions.manage.key);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display">Lavados</h1>

        {canManage ? (
          <Button asChild>
            <Link href="/carwash/nuevo">Nuevo lavado</Link>
          </Button>
        ) : null}
      </header>

      {/* Filtros como pestañas de filete, no como desplegable: son tres y se
          tocan con el dedo en la tablet del mostrador (RN-17). */}
      <div className="border-rule flex gap-1 border-b">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            aria-current={filter === option.key ? 'true' : undefined}
            className={cn(
              'min-h-(--touch-min) -mb-px border-b-2 px-3 text-body transition-colors duration-(--duration-state) ease-standard',
              filter === option.key
                ? 'border-brand text-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <TicketsTable
        tickets={tickets.data ?? []}
        isLoading={tickets.isPending}
        errorMessage={tickets.error?.message ?? null}
      />
    </div>
  );
}

function TicketsTable({
  tickets,
  isLoading,
  errorMessage,
}: {
  tickets: Ticket[];
  isLoading: boolean;
  errorMessage: string | null;
}) {
  const notice = errorMessage ?? (isLoading ? 'Cargando…' : 'No hay lavados en esta vista.');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Ref.</TableHead>
          <TableHead>Placa</TableHead>
          <TableHead className="hidden sm:table-cell">Cliente</TableHead>
          <TableHead className="hidden md:table-cell">Lavador</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className={cn(
                'whitespace-normal text-dense',
                errorMessage === null ? 'text-muted-foreground' : 'text-stamp-red',
              )}
            >
              {notice}
            </TableCell>
          </TableRow>
        ) : (
          tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="align-middle">
                <Reference value={referenceOf(ticket.number)} />
              </TableCell>
              <TableCell>
                <Link
                  href={`/carwash/${ticket.id}`}
                  className="flex min-h-(--touch-min) flex-col justify-center gap-0.5 rounded-md text-left"
                >
                  <span className="text-body font-mono">{ticket.vehicle.plate}</span>
                  <span className="text-dense text-muted-foreground sm:hidden">
                    {ticket.customer.fullName}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">
                {ticket.customer.fullName}
              </TableCell>
              <TableCell className="text-muted-foreground hidden md:table-cell">
                {/* Sin lavador el ticket se abrió desde el mostrador (RN-8). */}
                {ticket.washer?.fullName ?? 'Oficina'}
              </TableCell>
              <TableCell>
                <TicketStatusStamp status={ticket.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">${ticket.total}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
