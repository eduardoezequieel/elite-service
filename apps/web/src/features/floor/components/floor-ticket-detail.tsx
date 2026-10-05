'use client';

import type { Ticket, WorkOrderStatus } from '@elite/shared';
import { ChevronDown, Phone } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { LastWashNote } from '@/features/carwash/components/last-wash-note';
import { ProductPicker } from '@/features/carwash/components/product-picker';
import { TicketLines } from '@/features/carwash/components/ticket-item-line';
import {
  activeShortage,
  originalQuantities,
  productItemsPayload,
  productSignature,
  productsFromTicket,
  stockShortageOf,
  type ProductPick,
} from '@/features/carwash/product-lines';
import { TicketNoteField } from '@/features/carwash/components/ticket-note-field';
import { useTicketNote } from '@/features/carwash/use-ticket-note';
import { TicketStatusHero } from '@/features/carwash/components/ticket-status-hero';
import { statusLabel, TicketStatusStamp } from '@/features/carwash/components/ticket-status-stamp';
import { timeOf } from '@/features/carwash/wait';
import { responsibleOf } from '@/features/carwash/responsible';
import { washerNames } from '@/features/carwash/washers';
import { listFloorProductOptions } from '../api';
import { useFloorTicket, useUpdateFloorTicket } from '../hooks/use-floor';
import {
  FloorStatusConfirmDialog,
  useFloorStatusConfirm,
  type FloorStatusAction,
} from './floor-status-confirm';
import { DetailSkeleton } from '@/components/ui/skeleton';

/** La pista no cobra: sus pasos son los tres primeros del ciclo (066). */
const FLOOR_STEPS: readonly WorkOrderStatus[] = ['OPEN', 'WASHING', 'READY'];

/** El único paso siguiente que la pista puede dar desde cada estado (036). */
const NEXT_STEP: Record<WorkOrderStatus, { action: FloorStatusAction; label: string } | null> = {
  OPEN: { action: 'start', label: 'Empezar lavado' },
  WASHING: { action: 'ready', label: 'Marcar listo' },
  READY: { action: 'reopen', label: 'Reabrir' },
  PAID: null,
  VOID: null,
};

/** Un dato de la ficha: el rótulo arriba, el valor abajo. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-body font-medium [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

/**
 * Un lavado visto desde la pista.
 *
 * No hay botón de cobrar ni de anular, y el backend tampoco expone esas rutas
 * para esta sesión: el empleado no cobra (RN-10) y no anula (RN-11). Ocultarlo
 * en la pantalla sin cerrarlo en el API sería decoración.
 */
export function FloorTicketDetail({ id }: { id: string }) {
  const ticket = useFloorTicket(id);

  if (ticket.isPending) {
    return <DetailSkeleton label="Cargando el lavado" />;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {ticket.error?.message ?? 'No se pudo cargar el lavado.'}
      </p>
    );
  }

  return <FloorTicketBody ticket={ticket.data} />;
}

function FloorTicketBody({ ticket }: { ticket: Ticket }) {
  const status = useFloorStatusConfirm(ticket);
  const sequence = Number(ticket.number.slice(ticket.number.indexOf('-') + 1));
  const { toast } = useToast();
  const update = useUpdateFloorTicket(ticket.id);
  // La nota que el mostrador guarde mientras esta pantalla está abierta llega
  // sola por el hilo; lo que se esté escribiendo acá no se pisa (041, 042).
  const note = useTicketNote(ticket.notes);

  const responsible = responsibleOf(ticket);
  const next = NEXT_STEP[ticket.status];
  const nextButton =
    next === null ? null : (
      <Button
        type="button"
        size="lg"
        variant={next.action === 'reopen' ? 'outline' : 'default'}
        className="w-full"
        onClick={() => status.ask(next.action)}
      >
        {next.label}
      </Button>
    );
  const vehicleLine = [ticket.bodyType.name, ticket.vehicle.make, ticket.vehicle.color]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4">
      {/* La placa es el título: es el nombre con el que se reconoce el carro a
          tres metros, que es la distancia a la que se mira esta pantalla. */}
      <ScreenHeader
        title={<PlateChip plate={ticket.vehicle.plate} size="lg" />}
        subtitle={`#${sequence} · ${vehicleLine}`}
      >
        <TicketStatusStamp status={ticket.status} size="lg" />
      </ScreenHeader>

      {/* Lo primero que se lee al abrir el lavado, antes de los datos y de los
          botones: si el carro dejó una advertencia la vez pasada, hay que verla
          antes de empezar a lavar (052). */}
      <LastWashNote lastWash={ticket.vehicle.lastWash} />

      {/* Desde `lg` (tablet horizontal), dos columnas con el panel a la
          derecha; por debajo, una sola y el panel primero (066). */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4 max-lg:order-2">
          <Card className="gap-2 px-card">
            <CardSectionHeading
              aside={<span className="text-text-faint tabular-nums">Total ${ticket.total}</span>}
            >
              Qué hacerle
            </CardSectionHeading>
            <TicketLines items={ticket.items} />
          </Card>

          {ticket.status === 'OPEN' ? (
            // Se remonta cuando cambian los productos guardados —los propios al
            // guardar, o los de oficina por el hilo—: el bloque arranca siempre
            // de lo que de verdad tiene el lavado.
            <FloorProducts
              key={productSignature(productsFromTicket(ticket.items))}
              ticket={ticket}
            />
          ) : null}

          <Card className="gap-3 px-card">
            <TicketNoteField
              id="floor-ticket-notes"
              value={note.value}
              original={ticket.notes}
              saving={update.isPending}
              error={update.error?.message ?? null}
              help="Se ve la próxima vez que venga este carro."
              conflict={note.conflict}
              onChange={note.setValue}
              onAcceptConflict={note.accept}
              onSave={() =>
                update.mutate(
                  { notes: note.value.trim() },
                  { onSuccess: () => toast({ title: 'Nota guardada' }) },
                )
              }
            />
          </Card>
        </div>

        <aside aria-label="Estado" className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card className="gap-4 px-card">
            <TicketStatusHero ticket={ticket} steps={FLOOR_STEPS} />
            {/* En el panel solo desde `lg`; por debajo va en la barra fija. */}
            {nextButton === null ? null : <div className="max-lg:hidden">{nextButton}</div>}
          </Card>

          <Card className="grid grid-cols-2 gap-x-4 gap-y-3.5 px-card max-narrow:grid-cols-1">
            <Fact label="Responsable" value={responsible?.fullName ?? 'Sin responsable'} />
            <Fact
              label="Teléfono"
              value={
                responsible?.phone ? (
                  <a
                    href={`tel:${responsible.phone.replace(/\D/g, '')}`}
                    className="hover:text-flame-text min-h-touch inline-flex items-center gap-2"
                  >
                    <Phone aria-hidden strokeWidth={1.5} className="size-icon" />
                    {responsible.phone}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Fact label="A cargo de" value={washerNames(ticket.washers)} />
            <Fact label="Entró" value={timeOf(ticket.createdAt)} />
          </Card>
        </aside>
      </div>

      {/* El siguiente paso, al alcance del pulgar (066): antes quedaba al
          fondo, debajo de productos y nota. Pegada al borde de abajo de la
          pantalla; desde `lg` el botón vive en el panel y la barra no va. */}
      {nextButton === null ? null : (
        <div className="bg-surface border-line sticky bottom-0 z-10 -mx-plate -mb-plate flex items-center gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <div className="flex min-w-0 flex-col max-md:hidden">
            <span className="text-text-faint text-label">Siguiente paso</span>
            <span className="text-text text-body truncate">
              <span className="font-mono font-bold">{ticket.vehicle.plate}</span> ·{' '}
              {statusLabel(ticket.status)}
            </span>
          </div>
          <div className="flex-1 md:ml-auto md:max-w-80">{nextButton}</div>
        </div>
      )}

      <FloorStatusConfirmDialog
        open={status.pending !== null}
        title={status.copy?.title ?? ''}
        summary={status.summary}
        confirmLabel={status.copy?.confirm ?? ''}
        loading={status.loading}
        error={status.error}
        onOpenChange={(open) => {
          if (!open) status.cancel();
        }}
        onConfirm={status.confirm}
      />
    </div>
  );
}

/**
 * Sumar productos desde la tablet (065 RN-17): quien lava es quien los aplica.
 *
 * El mismo bloque del alta, sin costos. Como `PATCH items` reemplaza las
 * líneas sueltas, los servicios sueltos viajan tal como están y el API solo mueve la
 * diferencia de productos. El API edita líneas solo con el lavado abierto, así
 * que el bloque aparece solo en ese estado.
 */
function FloorProducts({ ticket }: { ticket: Ticket }) {
  const { toast } = useToast();
  const update = useUpdateFloorTicket(ticket.id);
  const saved = useMemo(() => productsFromTicket(ticket.items), [ticket.items]);
  const original = useMemo(() => originalQuantities(ticket.items), [ticket.items]);
  const [products, setProducts] = useState<ProductPick[]>(saved);
  const shortage = activeShortage(stockShortageOf(update.error), products);
  const dirty = productSignature(products) !== productSignature(saved);

  function save(): void {
    update.mutate(
      {
        items: [
          // Solo lo suelto: las líneas de un combo no viajan en `items`, y sin
          // `combos` el API deja los combos del lavado como están (104).
          ...ticket.items.flatMap((item) =>
            item.kind === 'SERVICE' && item.serviceId !== null && item.comboId === null
              ? [{ serviceId: item.serviceId, unitPrice: item.unitPrice }]
              : [],
          ),
          ...productItemsPayload(products),
        ],
      },
      { onSuccess: () => toast({ title: 'Productos guardados' }) },
    );
  }

  const count =
    products.length === 0
      ? 'Ninguno'
      : products.length === 1
        ? '1 producto'
        : `${products.length} productos`;

  // Plegado mientras no tenga productos (066): en la tablet empujaba el resto
  // de la ficha hacia abajo aunque casi nunca se use.
  return (
    <Card className="px-card">
      <details className="group flex flex-col" open={saved.length > 0}>
        <summary className="min-h-touch flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-col">
            <span className="text-text text-title">Productos</span>
            <span className="text-text-faint text-dense mt-1">
              {count} · salen del inventario al guardar; lo que se quita vuelve.
            </span>
          </span>
          <ChevronDown
            aria-hidden
            strokeWidth={1.5}
            className="text-text-faint size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard group-open:rotate-180"
          />
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <ProductPicker
            scope="floor"
            searchProducts={listFloorProductOptions}
            value={products}
            onChange={setProducts}
            original={original}
            shortage={shortage}
            idPrefix={`floor-${ticket.id}`}
            disabled={update.isPending}
          />

          {update.error ? (
            <p className="text-danger-text text-body" role="alert">
              {update.error.message}
            </p>
          ) : null}

          {dirty ? (
            <div className="flex flex-wrap gap-2 max-md:flex-col">
              <Button type="button" size="lg" loading={update.isPending} onClick={save}>
                Guardar productos
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={update.isPending}
                onClick={() => {
                  update.reset();
                  setProducts(saved);
                }}
              >
                Deshacer
              </Button>
            </div>
          ) : null}
        </div>
      </details>
    </Card>
  );
}
