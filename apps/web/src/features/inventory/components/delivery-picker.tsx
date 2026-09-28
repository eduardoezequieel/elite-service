'use client';

import type { InventoryItem, InventoryItemKind } from '@elite/shared';
import { Minus, Plus, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatMoney } from '@/lib/money';
import { formatQuantity, formatQuantityWithUnit, milliToQuantity } from '@/lib/quantity';
import { consumptionValueLine } from '../consumption';
import {
  ONE_UNIT_MILLI,
  categoryKeyOf,
  deliveryMovementOf,
  groupItems,
  isShort,
  itemChips,
  leftAfter,
  type DeliveryLine,
  type ItemChip,
} from '../delivery';
import { useInventoryItems } from '../hooks/use-inventory';

/** Una página grande alcanza para los chips; con más, se busca. */
const ITEMS_PAGE_SIZE = 100;

/**
 * «¿Qué se lleva?» (spec 091): el selector del lavado (085) sobre productos e
 * insumos. Sin escribir no hay lista: solo los chips de categoría, en dos
 * renglones. Un chip abre sus artículos y otro toque lo cierra; escribir busca
 * en todas. Cada fila dice si queda como «Consumo» o como «Despacho» (RN-1) y
 * lleva su `− N +`. Lo elegido va arriba, aunque la búsqueda ya no lo traiga.
 */
export function DeliveryPicker({
  kind,
  lines,
  known,
  onStep,
  onType,
  disabled = false,
}: {
  /** Solo de un tipo (desde el consumo de un trabajador, productos). Sin él, los dos. */
  kind?: InventoryItemKind;
  lines: readonly DeliveryLine[];
  /** Los artículos elegidos, para dibujar su fila aunque la búsqueda no los traiga. */
  known: Readonly<Record<string, InventoryItem>>;
  onStep: (item: InventoryItem, deltaMilli: number) => void;
  onType: (item: InventoryItem, quantity: string) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const [openChip, setOpenChip] = useState<string | null>(null);
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';

  const all = useInventoryItems({ kind, pageSize: ITEMS_PAGE_SIZE });
  const found = useInventoryItems({ kind, search, pageSize: ITEMS_PAGE_SIZE }, searching);
  const allItems = all.data?.items ?? [];
  const chips = itemChips(allItems, lines);
  const kinds = [...new Set(chips.map((chip) => chip.kind))];
  const pickedIds = new Set(lines.map((line) => line.itemId));
  const free = (items: readonly InventoryItem[]) => items.filter((item) => !pickedIds.has(item.id));

  function toggleChip(key: string): void {
    // Tocar un chip con búsqueda escrita la borra: la categoría manda (085).
    if (term !== '') {
      setTerm('');
      setOpenChip(key);
      return;
    }
    setOpenChip((current) => (current === key ? null : key));
  }

  const row = (item: InventoryItem) => (
    <DeliveryRow
      key={item.id}
      item={item}
      line={lines.find((line) => line.itemId === item.id)}
      onStep={(delta) => onStep(item, delta)}
      onType={(quantity) => onType(item, quantity)}
      disabled={disabled}
    />
  );

  function below(): ReactNode {
    const source = searching ? found : all;
    if (source.isPending) return <Hint>Cargando artículos…</Hint>;
    if (source.error) {
      return (
        <p className="text-danger-text text-dense" role="alert">
          {source.error.message}
        </p>
      );
    }

    if (searching) {
      const matches = found.data?.items ?? [];
      const groups = groupItems(free(matches));
      if (groups.length === 0) {
        return matches.length > 0 ? (
          <Hint>Lo que buscás ya está elegido arriba.</Hint>
        ) : (
          <Hint>Nada con «{search}». Probá con otra palabra o tocá una categoría.</Hint>
        );
      }

      return (
        <>
          <Hint>Buscando en todas las categorías.</Hint>
          {groups.map((group) => (
            <div key={group.key} className="grid gap-2.5">
              <p className="text-text-faint mx-0.5 mt-1.5 text-label">
                {group.name}
                {kind === undefined
                  ? ` · ${group.kind === 'PRODUCT' ? 'Productos' : 'Insumos'}`
                  : ''}
              </p>
              {group.items.map(row)}
            </div>
          ))}
        </>
      );
    }

    if (allItems.length === 0) return <Hint>No hay artículos activos todavía.</Hint>;

    if (openChip !== null) {
      const items = free(allItems.filter((item) => categoryKeyOf(item) === openChip));
      const group = groupItems(items)[0];

      return group === undefined ? (
        <Hint>Ya elegiste todo lo de esta categoría.</Hint>
      ) : (
        group.items.map(row)
      );
    }

    return lines.length === 0 ? <Hint>Tocá una categoría o buscá por nombre.</Hint> : null;
  }

  const rest = below();

  return (
    <div className="grid gap-2.5">
      <FieldBox>
        <Label htmlFor="delivery-search">
          {kind === 'PRODUCT' ? 'Buscar producto' : 'Buscar producto o insumo'}
        </Label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <Input
            id="delivery-search"
            className="min-w-0 flex-1"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Coca, franela, INV-0002…"
            autoComplete="off"
            enterKeyHint="search"
            disabled={disabled}
            data-keeps-escape={term !== '' || undefined}
            onKeyDown={(event) => {
              // Enter busca, no manda la entrega.
              if (event.key === 'Enter') event.preventDefault();
              if (event.key === 'Escape' && term !== '') {
                event.preventDefault();
                setTerm('');
              }
            }}
          />
          {term === '' ? null : (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Borrar búsqueda"
              className="text-text-faint hover:bg-surface-3 hover:text-text grid size-touch shrink-0 cursor-pointer place-items-center rounded-control transition-colors duration-(--duration-state) ease-standard"
            >
              <X aria-hidden strokeWidth={1.5} className="size-icon" />
            </button>
          )}
        </div>
      </FieldBox>

      {kinds.map((chipKind) => (
        <div
          key={chipKind}
          role="group"
          aria-label={`Categorías de ${chipKind === 'PRODUCT' ? 'productos' : 'insumos'}`}
          className="flex flex-wrap items-center gap-2"
        >
          {kinds.length > 1 ? (
            <span className="text-text-faint min-w-16 text-label">
              {chipKind === 'PRODUCT' ? 'Productos' : 'Insumos'}
            </span>
          ) : null}
          {chips
            .filter((chip) => chip.kind === chipKind)
            .map((chip) => (
              <ChipButton
                key={chip.key}
                chip={chip}
                pressed={!searching && openChip === chip.key}
                muted={searching}
                disabled={disabled}
                onToggle={() => toggleChip(chip.key)}
              />
            ))}
        </div>
      ))}

      {lines.map((line) => {
        const item = known[line.itemId];

        return item === undefined ? null : (
          <DeliveryRow
            key={line.itemId}
            item={item}
            line={line}
            onStep={(delta) => onStep(item, delta)}
            onType={(quantity) => onType(item, quantity)}
            disabled={disabled}
          />
        );
      })}

      {lines.length > 0 && rest !== null ? (
        <div role="presentation" className="bg-line-soft my-1 h-px" />
      ) : null}

      {rest}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-text-faint mx-0.5 mt-0.5 text-dense">{children}</p>;
}

/** El chip del 085: nombre, cuántos tiene y, si llevás algo, el numerito. */
function ChipButton({
  chip,
  pressed,
  muted,
  disabled,
  onToggle,
}: {
  chip: ItemChip;
  pressed: boolean;
  muted: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'text-text inline-flex min-h-(--touch-min) cursor-pointer items-center gap-2 rounded-full border-(length:--selectable-border) px-3.5 font-semibold',
        'transition-[border-color,background-color,opacity] duration-(--duration-state) ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-55',
        '[[data-density=bahia]_&]:px-5',
        pressed
          ? 'border-flame bg-flame/12'
          : cn('border-line bg-surface-2 hover:border-text-faint', muted && 'opacity-55'),
      )}
    >
      {chip.name}
      <span className="text-text-faint text-dense font-medium tabular-nums">{chip.total}</span>
      {chip.picked > 0 ? (
        <span
          aria-label={`${formatQuantity(milliToQuantity(chip.picked))} elegidos`}
          className="gradient-action grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-(length:--count-size) font-bold text-white tabular-nums"
        >
          {formatQuantity(milliToQuantity(chip.picked))}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Una fila: nombre y código, si queda como consumo o despacho, cuánto hay o
 * cuánto queda, y el `− N +`. El número se puede escribir (medio galón). Un
 * producto elegido muestra su valor a precio de venta.
 */
function DeliveryRow({
  item,
  line,
  onStep,
  onType,
  disabled,
}: {
  item: InventoryItem;
  line: DeliveryLine | undefined;
  onStep: (deltaMilli: number) => void;
  onType: (quantity: string) => void;
  disabled: boolean;
}) {
  const on = line !== undefined;
  const short = isShort(item, line);
  const left = leftAfter(item, line);
  const isProduct = item.kind === 'PRODUCT';
  const canAdd = !disabled && leftAfter(item, line) >= ONE_UNIT_MILLI;
  const formula = on && isProduct ? consumptionValueLine(line.quantity, item.price) : null;
  const stockLabel = short
    ? `No alcanza: hay ${formatQuantityWithUnit(item.stockOnHand, item.unit)}`
    : left <= 0
      ? on
        ? 'No queda más'
        : 'Sin existencia'
      : `${on ? 'Quedan' : 'Hay'} ${formatQuantityWithUnit(milliToQuantity(left), item.unit)}`;

  return (
    <div
      className={cn(
        'min-h-row bg-surface-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-row border-(length:--selectable-border) px-(--field-px) py-2',
        'transition-colors duration-(--duration-state) ease-standard',
        short
          ? 'border-danger'
          : on
            ? 'border-[color-mix(in_oklab,var(--flame)_45%,var(--line))]'
            : 'border-line',
      )}
    >
      <span className="min-w-40 flex-1">
        <span className="text-text block font-semibold [[data-density=bahia]_&]:text-title">
          {item.name}
          <span className="text-text-faint ml-1.5 font-mono text-dense font-normal">
            {item.code}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* RN-1: la fila dice qué va a quedar en el kardex. */}
          <span
            className={cn(
              'tint rounded-full border px-1.5 text-label',
              deliveryMovementOf(item.kind) === 'CONSUMPTION'
                ? 'text-consume-text'
                : 'text-warn-text',
            )}
          >
            {deliveryMovementOf(item.kind) === 'CONSUMPTION' ? 'Consumo' : 'Despacho'}
          </span>
          <span
            className={cn(
              'text-dense',
              short ? 'text-danger-text font-semibold' : 'text-text-faint',
            )}
            role={short ? 'alert' : undefined}
          >
            {stockLabel}
          </span>
        </span>
        {formula === null ? null : (
          <span className="text-text-dim block font-mono text-dense tabular-nums">{formula}</span>
        )}
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-3">
        {isProduct ? (
          <span className="text-text font-mono text-body font-bold tabular-nums">
            {formatMoney(item.price)}
          </span>
        ) : null}

        <span
          role="group"
          aria-label={`Cantidad de ${item.name}`}
          className={cn(
            'bg-surface inline-flex items-center overflow-hidden rounded-control border',
            on ? 'border-flame' : 'border-line',
          )}
        >
          <button
            type="button"
            onClick={() => onStep(-ONE_UNIT_MILLI)}
            disabled={disabled || !on}
            aria-label={`Quitar uno de ${item.name}`}
            className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center transition-colors duration-(--duration-state) ease-standard disabled:cursor-not-allowed disabled:bg-transparent"
          >
            <Minus aria-hidden strokeWidth={1.5} className="size-icon" />
          </button>
          {on ? (
            <input
              inputMode="decimal"
              autoComplete="off"
              value={line.quantity}
              onChange={(event) => onType(event.target.value)}
              aria-label={`Cantidad de ${item.name}`}
              className="text-text w-11 bg-transparent text-center font-mono text-body font-bold tabular-nums outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flame-hot [[data-density=bahia]_&]:w-13 [[data-density=bahia]_&]:text-title"
            />
          ) : (
            <span className="text-text w-11 text-center font-mono text-body font-bold tabular-nums [[data-density=bahia]_&]:w-13 [[data-density=bahia]_&]:text-title">
              0
            </span>
          )}
          <button
            type="button"
            onClick={() => onStep(ONE_UNIT_MILLI)}
            disabled={!canAdd}
            aria-label={`Agregar uno de ${item.name}`}
            title={canAdd ? undefined : 'No hay más existencia'}
            className="text-text hover:bg-surface-2 disabled:text-text-faint grid size-touch cursor-pointer place-items-center transition-colors duration-(--duration-state) ease-standard disabled:cursor-not-allowed disabled:bg-transparent"
          >
            <Plus aria-hidden strokeWidth={1.5} className="size-icon" />
          </button>
        </span>
      </span>
    </div>
  );
}
