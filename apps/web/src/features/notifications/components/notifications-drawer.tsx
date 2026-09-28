'use client';

import { ArrowLeftRight, Ban, Banknote, CheckCheck, LogIn, Package, Search } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCarwashLive } from '@/features/carwash/hooks/use-carwash-live';
import { cn } from '@/lib/utils';

import {
  ALL_DAYS,
  EMPTY_FILTER,
  countOfKind,
  filterNotifications,
  groupByDay,
  visibleKinds,
  type NotificationFilter,
} from '../filters';
import { useNotifications } from '../hooks/use-notifications';
import type { Notification, NotificationKind } from '../notification';
import { dayKeyOf } from '../store';

/**
 * El cajón de avisos (spec 058).
 *
 * Sube desde abajo y se queda pegado al pie en todos los anchos: la fila de
 * lavados sigue a la vista detrás, que es contra lo que se lee un aviso. Antes
 * era un menú desplegable de 320px colgado del riel, donde no entraba medio
 * aviso y no había forma de buscar nada.
 *
 * Tres recortes, todos sobre la misma bandeja: el día, el tipo y el texto. La
 * lógica de recortar y agrupar vive en `../filters` y tiene sus tests; acá solo
 * se pinta.
 */

/** Trazo del sistema para los iconos de `lucide-react`. */
const ICON_STROKE_WIDTH = 1.5;

/** El color del aviso. Nunca es la única señal: siempre va con su texto. */
const TONE_CLASS: Record<Notification['tone'], string> = {
  go: 'text-go-text',
  danger: 'text-danger-text',
  neutral: 'text-text-dim',
};

/** Un icono por tipo, que repite lo que dice el título; nunca lo reemplaza. */
const KIND_ICON: Record<NotificationKind, typeof LogIn> = {
  in: LogIn,
  move: ArrowLeftRight,
  cash: Banknote,
  void: Ban,
  stock: Package,
};

export function NotificationsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const { isLive } = useCarwashLive();
  const { can } = usePermissions();
  const [filter, setFilter] = React.useState<NotificationFilter>(EMPTY_FILTER);

  // El «hoy» se fija al abrir: si el cajón se dejó abierto y pasó la medianoche,
  // las cabeceras no se renombran solas debajo del dedo.
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (open) setNow(new Date());
  }, [open]);

  const days = React.useMemo(() => groupByDay(items, now), [items, now]);
  const inDay = React.useMemo(
    () =>
      filter.day === ALL_DAYS ? items : items.filter((item) => dayKeyOf(item.at) === filter.day),
    [items, filter.day],
  );
  const shown = React.useMemo(() => filterNotifications(items, filter), [items, filter]);
  const groups = React.useMemo(() => groupByDay(shown, now), [shown, now]);

  // Sin el permiso de caja no llegan avisos de dinero (058), ni de inventario
  // sin `inventory.read` (065), así que tampoco se ofrece su filtro: un chip que
  // siempre dice 0 es una puerta cerrada con cartel.
  const kinds = visibleKinds(can);

  const set = (patch: Partial<NotificationFilter>) =>
    setFilter((current) => ({ ...current, ...patch }));

  const pendingHere = inDay.filter((item) => !item.read).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="drawer" className="p-0">
        <DialogHeader className="gap-1">
          <DialogTitle>Avisos</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'tint inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-label',
                isLive ? 'text-go-text' : 'text-text-dim',
              )}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {isLive ? 'en vivo' : 'sin conexión'}
            </span>
            <span className="tabular-nums">
              {unread === 0
                ? `${items.length} avisos, todos leídos`
                : `${unread} sin leer de ${items.length}`}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-plate pt-3 md:grid-cols-[210px_minmax(0,1fr)]">
          {/* Los días, en columna en escritorio. */}
          <aside className="hidden min-h-0 overflow-y-auto md:block" aria-label="Filtrar por día">
            <p className="text-text-faint px-1 pb-2 text-label">Día</p>
            <DayButton
              label="Todos los días"
              date={`${days.length} ${days.length === 1 ? 'día' : 'días'}`}
              total={items.length}
              unread={unread}
              selected={filter.day === ALL_DAYS}
              onSelect={() => set({ day: ALL_DAYS })}
            />
            {days.map((day) => (
              <DayButton
                key={day.key}
                label={day.label}
                date={day.date}
                total={day.items.length}
                unread={day.unread}
                selected={filter.day === day.key}
                onSelect={() => set({ day: day.key })}
              />
            ))}
          </aside>

          <div className="flex min-h-0 flex-col">
            {/* En táctil los días son un carril de píldoras. */}
            <div
              className="flex shrink-0 gap-1.5 overflow-x-auto pb-2.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
              aria-label="Filtrar por día"
            >
              <FilterChip
                label="Todos"
                count={items.length}
                selected={filter.day === ALL_DAYS}
                onSelect={() => set({ day: ALL_DAYS })}
              />
              {days.map((day) => (
                <FilterChip
                  key={day.key}
                  label={day.label}
                  count={day.items.length}
                  selected={filter.day === day.key}
                  onSelect={() => set({ day: day.key })}
                />
              ))}
            </div>

            {/* Buscador, tipos e interruptor: tres zonas, sin `wrap` que decida
                por su cuenta dónde se parte la fila. */}
            <div className="flex shrink-0 flex-wrap items-center gap-2.5 pb-3 md:flex-nowrap">
              <div className="relative order-1 min-w-0 flex-1 md:flex-none md:basis-60">
                <Search
                  className="text-text-faint pointer-events-none absolute top-1/2 left-3 size-icon -translate-y-1/2"
                  strokeWidth={ICON_STROKE_WIDTH}
                  aria-hidden
                />
                <Input
                  type="search"
                  value={filter.query}
                  onChange={(event) => set({ query: event.target.value })}
                  placeholder="Buscar placa o número"
                  aria-label="Buscar en los avisos"
                  className="pl-[calc(24px+var(--icon-size))]"
                />
              </div>

              <div
                className="order-3 flex w-full gap-1.5 overflow-x-auto py-0.75 [scrollbar-width:none] md:order-2 md:w-auto md:min-w-0 md:flex-1 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Filtrar por tipo"
              >
                {kinds.map((entry) => (
                  <FilterChip
                    key={entry.kind}
                    label={entry.label}
                    count={countOfKind(inDay, entry.kind)}
                    selected={filter.kind === entry.kind}
                    onSelect={() => set({ kind: entry.kind })}
                  />
                ))}
              </div>

              <span
                className="bg-line order-2 hidden h-6 w-px shrink-0 md:order-3 md:block"
                aria-hidden
              />

              <FilterChip
                className="order-2 md:order-4"
                label="Solo sin leer"
                count={pendingHere}
                selected={filter.unreadOnly}
                onSelect={() => set({ unreadOnly: !filter.unreadOnly })}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {groups.length === 0 ? (
                <DrawerEmpty filter={filter} />
              ) : (
                groups.map((group) => (
                  <section key={group.key}>
                    <div className="bg-surface border-line-soft text-text-faint sticky top-0 z-[2] flex items-baseline gap-2.5 border-b px-0.5 pt-2.5 pb-2 text-dense">
                      <b className="text-text text-(length:--group-size) font-semibold">
                        {group.label}
                      </b>
                      <span>{group.date}</span>
                      <span className="ml-auto tabular-nums">{group.items.length}</span>
                    </div>

                    {group.items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        onOpen={() => {
                          markRead(item.id);
                          onOpenChange(false);
                        }}
                      />
                    ))}
                  </section>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <span className="text-text-faint hidden flex-1 text-dense tabular-nums sm:inline">
            {shown.length === items.length
              ? `${items.length} avisos`
              : `${shown.length} de ${items.length} avisos`}
          </span>
          <Button variant="secondary" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            Marcar todo como leído
          </Button>
          <Button asChild onClick={() => onOpenChange(false)}>
            <Link href="/carwash">Ir a la fila</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un día en la columna: cómo se llama, cuándo fue y cuánto queda por leer. */
function DayButton({
  label,
  date,
  total,
  unread,
  selected,
  onSelect,
}: {
  label: string;
  date: string;
  total: number;
  unread: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'mb-1 flex min-h-(--touch-min) w-full items-center gap-2.5 rounded-control border px-3 py-2 text-left transition-colors duration-(--duration-state) ease-standard',
        selected
          ? 'border-flame bg-surface-2 text-text font-semibold'
          : 'text-text-dim hover:bg-surface-2 border-transparent',
      )}
    >
      <span className="min-w-0 truncate">
        {label}
        <span className="text-text-faint block text-(length:--meta-size) font-normal">{date}</span>
      </span>
      <span
        className={cn(
          'ml-auto text-(length:--meta-size) tabular-nums',
          unread > 0 ? 'text-flame-text font-semibold' : 'text-text-faint',
        )}
      >
        {unread > 0 ? `${unread} sin leer` : total}
      </span>
    </button>
  );
}

/** Píldora de filtro: siempre con su cuenta, y del alto de los campos. */
function FilterChip({
  label,
  count,
  selected,
  onSelect,
  className,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'border-line inline-flex h-control shrink-0 items-center gap-1.75 rounded-full border px-3.5 text-dense font-semibold whitespace-nowrap transition-colors duration-(--duration-state) ease-standard',
        selected
          ? 'border-flame bg-flame/12 text-text'
          : 'text-text-dim hover:border-flame bg-transparent',
        className,
      )}
    >
      {label}
      <span
        className={cn(
          'text-(length:--count-size) font-semibold tabular-nums',
          selected ? 'text-flame-text' : 'text-text-faint',
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Un aviso: hora, tipo y los tres renglones de la 042. */
function NotificationRow({ item, onOpen }: { item: Notification; onOpen: () => void }) {
  const Icon = KIND_ICON[item.kind];

  return (
    <Link
      href={item.href}
      onClick={onOpen}
      className={cn(
        'border-line-soft hover:bg-surface-3 mt-2 flex min-h-(--row-h) w-full items-start gap-3 rounded-row border p-3.5 transition-colors duration-(--duration-state) ease-standard',
        item.read ? 'bg-transparent' : 'bg-surface-2',
      )}
    >
      <span className="text-text-faint w-11 shrink-0 pt-0.5 text-dense tabular-nums">
        {timeOf(item.at)}
      </span>

      <span
        className={cn(
          'tint inline-flex size-7.5 shrink-0 items-center justify-center rounded-full border',
          TONE_CLASS[item.tone],
        )}
      >
        <Icon className="size-icon" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn('block text-body font-semibold', TONE_CLASS[item.tone])}>
          {item.title}
        </span>
        {item.kind === 'stock' ? (
          // El aviso de inventario no tiene carro: el detalle es la existencia,
          // sin chip de placa (065).
          <span className="text-text-faint mt-1 block text-dense tabular-nums">
            {item.description}
          </span>
        ) : (
          <span className="text-text-faint mt-1 flex flex-wrap items-center gap-2 text-dense">
            <PlateChip plate={plateOf(item.description)} size="sm" />
            {detailOf(item.description) === '' ? null : <span>{detailOf(item.description)}</span>}
          </span>
        )}
        {item.by === null ? null : (
          <span className="text-text-faint mt-0.5 block text-dense">{item.by}</span>
        )}
      </span>

      {item.read ? null : (
        <span className="bg-flame mt-2 size-2 shrink-0 rounded-full" aria-hidden />
      )}
    </Link>
  );
}

/** El vacío dice por qué está vacío: no es lo mismo no encontrar que no tener. */
function DrawerEmpty({ filter }: { filter: NotificationFilter }) {
  if (filter.query.trim() !== '') {
    return (
      <EmptyState
        className="mt-4"
        title={`Nada con «${filter.query.trim()}»`}
        description="Buscá por placa —P052-201— o por número de lavado, como #7."
      />
    );
  }

  if (filter.unreadOnly) {
    return (
      <EmptyState
        className="mt-4"
        title="Todo leído"
        description="No queda ningún aviso sin leer con este recorte. Quitá «Solo sin leer» para ver el resto."
      />
    );
  }

  return (
    <EmptyState
      className="mt-4"
      title="Sin avisos acá"
      description="Acá van a aparecer los cambios que haga otra persona en la fila de lavados: un carro que entra, uno que queda listo, uno que se cobra."
    />
  );
}

/** La hora del aparato, en 24h. La bandeja es local, igual que sus días. */
function timeOf(at: string): string {
  const date = new Date(at);

  if (Number.isNaN(date.getTime())) return '--:--';

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * La descripción de un aviso es «placa» o «placa · dato» (042). El chip de
 * placa quiere la placa sola, así que se parte acá y no en el modelo: lo que
 * viaja sigue siendo una frase legible.
 */
function plateOf(description: string): string {
  const [plate] = description.split(' · ');

  return plate ?? description;
}

function detailOf(description: string): string {
  const [, ...rest] = description.split(' · ');

  return rest.join(' · ');
}
