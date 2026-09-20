'use client';

import type { ServiceDetail } from '@elite/shared';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/ui/stamp';
import { cn } from '@/lib/utils';
import {
  catalogPriceOf,
  groupByCategory,
  toggleService,
  type ServiceSelection,
} from '../service-groups';
import { clampToCatalog, discountCents, maskMoneyInput } from '../pricing';

/**
 * Elegir los servicios de un lavado: un rubro por fila, plegado (050).
 *
 * Nace de que el catálogo del taller va a crecer. Con todos los servicios a la
 * vista la pantalla se vuelve un scroll interminable, así que lo que se ve por
 * defecto es **una fila por rubro** con lo que quedó elegido; las opciones solo
 * aparecen en el rubro que se abre, y se abre uno a la vez. Así el alto de la
 * sección crece con la cantidad de rubros, no con la de servicios.
 *
 * Las reglas de negocio no cambian: uno por rubro y los rubros se suman (039),
 * descuento por línea con el tope del catálogo (030 RN-3, 022 RN-5).
 *
 * La selección es controlada —vive en el formulario, que es quien la manda al
 * API—; acá adentro solo queda el estado de la pantalla: qué rubro está abierto
 * y qué precio se está editando.
 */
export function ServicePicker({
  services,
  bodyTypeId,
  value,
  onChange,
  canEditPrice = true,
  idPrefix,
}: {
  services: ServiceDetail[];
  /** Sin tipo de carro no hay precio que mostrar: lo resuelve quien llama. */
  bodyTypeId: string;
  value: ServiceSelection;
  onChange: (next: ServiceSelection) => void;
  /** En la pista también se descuenta (030); un lector sin permiso, no. */
  canEditPrice?: boolean;
  /** Para que los `id` no choquen si hay dos pickers en la misma página. */
  idPrefix: string;
}) {
  const groups = useMemo(() => groupByCategory(services), [services]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (groups.length === 0) {
    return <p className="text-text-dim text-body">El catálogo no tiene servicios activos.</p>;
  }

  /** Abrir un rubro cierra el anterior: eso es lo que mantiene corta la lista. */
  function toggleGroup(groupId: string): void {
    setOpen((current) => (current === groupId ? null : groupId));
    setEditing(null);
  }

  /** Elegir pliega el rubro y deja lo elegido a la vista en la fila. */
  function choose(service: ServiceDetail): void {
    onChange(toggleService(value, service, services));
    setEditing(null);
    setOpen(null);
  }

  function setPrice(serviceId: string, price: string): void {
    onChange({ ...value, prices: { ...value.prices, [serviceId]: price } });
  }

  function startEdit(service: ServiceDetail, catalog: string): void {
    const wasOn = value.selected.includes(service.id);
    const next = wasOn ? value : toggleService(value, service, services);

    onChange({
      ...next,
      prices: { ...next.prices, [service.id]: next.prices[service.id] ?? catalog },
    });
    setOpen(service.category.id);
    setEditing(service.id);
  }

  function commit(serviceId: string, catalog: string): void {
    const current = value.prices[serviceId];

    if (current !== undefined) setPrice(serviceId, clampToCatalog(current, catalog));
    setEditing(null);
  }

  return (
    <div className="grid gap-2.5">
      {groups.map((group) => {
        const picked = group.services.find((service) => value.selected.includes(service.id));
        const isOpen = open === group.id;
        const pickedPrice =
          picked === undefined
            ? null
            : (value.prices[picked.id] ?? catalogPriceOf(picked, bodyTypeId));

        return (
          <section
            key={group.id}
            className={cn(
              'overflow-hidden rounded-row border-[1.5px] transition-colors duration-(--duration-state) ease-standard',
              isOpen
                ? 'border-flame bg-surface-2'
                : picked
                  ? 'border-[color-mix(in_oklab,var(--flame)_45%,var(--line))] bg-surface-2'
                  : 'border-line bg-surface-2',
            )}
          >
            <div className="min-h-row flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`${idPrefix}-group-${group.id}`}
                className="min-h-touch flex min-w-0 flex-1 cursor-pointer items-center text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-text-faint text-dense block">{group.name}</span>
                  <span
                    className={cn(
                      'block truncate',
                      picked ? 'text-text font-semibold' : 'text-text-faint',
                    )}
                  >
                    {picked
                      ? picked.name
                      : group.services.length === 1
                        ? 'Tocá para agregarlo'
                        : 'Elegir'}
                  </span>
                </span>
              </button>

              {picked && pickedPrice !== null ? (
                <span className="text-text shrink-0 font-mono text-body font-bold tabular-nums">
                  ${pickedPrice}
                </span>
              ) : (
                <span className="text-text-faint shrink-0 text-dense">{group.services.length}</span>
              )}

              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn(
                  'size-icon shrink-0 transition-transform duration-(--duration-state) ease-standard',
                  isOpen ? 'text-flame-text rotate-180' : 'text-text-faint',
                )}
              />
            </div>

            {isOpen ? (
              <div
                id={`${idPrefix}-group-${group.id}`}
                className="border-line-soft border-t px-4 pt-3 pb-3.5"
              >
                <div className="grid gap-2.5" role="radiogroup" aria-label={group.name}>
                  {group.services.map((service) => {
                    const catalog = catalogPriceOf(service, bodyTypeId);
                    const isOn = value.selected.includes(service.id);
                    const charged = isOn ? (value.prices[service.id] ?? catalog) : catalog;

                    return (
                      <ServiceChoice
                        key={service.id}
                        inputId={`${idPrefix}-price-${service.id}`}
                        label={service.name}
                        catalogPrice={catalog}
                        chargedPrice={charged}
                        selected={isOn}
                        canEditPrice={canEditPrice}
                        isEditing={isOn && editing === service.id}
                        onSelect={() => choose(service)}
                        onStartEdit={() => startEdit(service, catalog)}
                        onPriceChange={(next) => setPrice(service.id, maskMoneyInput(next))}
                        onCommit={() => commit(service.id, catalog)}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Una opción que se toca: la lámina con su radio a la izquierda y el precio a
 * la derecha.
 *
 * El precio **es un botón** cuando se puede descontar (030): al tocarlo, la
 * lámina queda elegida y el precio se escribe ahí mismo. El del catálogo se
 * queda tachado al lado, para que el descuento se vea sin tener que recordarlo.
 *
 * Bajo 900px el precio baja de renglón. En una sola fila radio + nombre + sello
 * + campo + «Listo» no caben y el nombre se aplasta contra el sello.
 *
 * La lámina no es un `<button>` porque contiene otro: es un `radio` de verdad,
 * con `tabIndex` y teclado propios.
 */
function ServiceChoice({
  inputId,
  label,
  catalogPrice,
  chargedPrice,
  selected,
  canEditPrice,
  isEditing,
  onSelect,
  onStartEdit,
  onPriceChange,
  onCommit,
}: {
  /** Propio de la línea: con varios rubros hay varios campos de precio. */
  inputId: string;
  label: string;
  catalogPrice: string;
  chargedPrice: string;
  selected: boolean;
  canEditPrice: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onPriceChange: (next: string) => void;
  onCommit: () => void;
}) {
  const off = selected ? discountCents(catalogPrice, chargedPrice) : 0;

  const discountStamp =
    off > 0 ? (
      <Stamp
        label={`−$${(off / 100).toFixed(2)}`}
        tone="washing"
        pulse={false}
        className="shrink-0"
      />
    ) : null;

  return (
    <div className="grid min-w-0 gap-2.5">
      <div
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'min-h-touch grid w-full min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 rounded-row border-[1.5px] px-4 py-3 text-left',
          'md:grid-cols-[auto_minmax(0,1fr)_auto]',
          'text-body transition-colors duration-(--duration-state) ease-standard',
          selected
            ? 'border-flame bg-[color-mix(in_oklab,var(--flame)_9%,transparent)]'
            : 'border-line bg-surface hover:border-text-faint',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'col-start-1 row-start-1 grid size-[18px] shrink-0 place-items-center rounded-full border-2',
            selected ? 'border-flame' : 'border-line',
          )}
        >
          {selected ? <span className="bg-flame size-[9px] rounded-full" /> : null}
        </span>

        <span className="col-start-2 row-start-1 min-w-0">
          <span className="text-text block font-semibold">{label}</span>
        </span>

        <span className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center justify-end gap-2 md:col-start-3 md:row-start-1">
          {isEditing ? (
            <>
              <span className="border-flame bg-surface-2 min-h-touch flex min-w-0 flex-1 items-center gap-1 rounded-control border-[1.5px] px-3 md:flex-none">
                <span className="text-text-dim font-mono font-bold">$</span>
                <label className="sr-only" htmlFor={inputId}>
                  Precio a cobrar
                </label>
                <input
                  id={inputId}
                  value={chargedPrice}
                  onChange={(event) => onPriceChange(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === 'Escape') {
                      event.preventDefault();
                      onCommit();
                    }
                  }}
                  onBlur={onCommit}
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  autoFocus
                  className="text-text w-full min-w-[4.5rem] border-0 bg-transparent p-0 text-right font-mono text-body font-bold tabular-nums outline-none md:w-[5.5rem]"
                />
              </span>

              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  onCommit();
                }}
              >
                Listo
              </Button>
            </>
          ) : (
            <>
              {discountStamp}
              {off > 0 ? (
                <span className="text-text-faint shrink-0 font-mono text-dense line-through">
                  ${catalogPrice}
                </span>
              ) : null}

              {canEditPrice ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEdit();
                  }}
                  title="Tocá el precio para hacer un descuento"
                  className={cn(
                    'min-h-touch border-line bg-surface hover:border-flame flex shrink-0 cursor-pointer items-center gap-2 rounded-control border px-3 font-mono text-body font-bold tabular-nums transition-colors duration-(--duration-state) ease-standard',
                    off > 0 &&
                      'text-flame-text border-[color-mix(in_oklab,var(--flame)_45%,var(--line))]',
                  )}
                >
                  ${chargedPrice}
                  <span aria-hidden="true" className="text-text-faint text-dense font-sans">
                    Editar
                  </span>
                </button>
              ) : (
                <span className="text-text shrink-0 font-mono text-body font-bold tabular-nums">
                  ${chargedPrice}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {isEditing ? (
        <p className="text-text-faint text-dense">
          Tope: ${catalogPrice} del catálogo. El descuento solo baja.
        </p>
      ) : null}
    </div>
  );
}
