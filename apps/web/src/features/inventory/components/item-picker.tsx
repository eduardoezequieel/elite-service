'use client';

import type { InventoryItem, InventoryItemKind } from '@elite/shared';
import { Check, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { formatQuantityWithUnit } from '@/lib/quantity';
import { useInventoryItems } from '../hooks/use-inventory';
import { enterPickIndex, isOutOfStock, nextEnabledIndex } from '../picker';
import { StockLine } from './item-field';

/** Cuántos resultados trae la búsqueda: el resto se encuentra escribiendo. */
const PICKER_PAGE_SIZE = 20;

const NOUN: Record<InventoryItemKind | 'ANY', string> = {
  PRODUCT: 'productos',
  SUPPLY: 'insumos',
  ANY: 'artículos',
};

/**
 * El artículo de un despacho o de una entrada (spec 072), **en línea**: la
 * búsqueda y la lista viven dentro del diálogo y se desplazan con él —nada
 * flota encima de los campos de abajo—. Elegido, queda una tarjeta con nombre,
 * código y existencia, y «Cambiar» vuelve a la búsqueda.
 *
 * Desde la ficha el artículo viene fijo y se muestra como texto: lo que no se
 * edita no es un control muerto. Solo artículos activos (RN-14). `kind` acota
 * a un tipo; con `requireStock` un artículo sin existencia aparece pero no se
 * puede elegir (el despacho no saca de donde no hay).
 */
export function ItemPicker({
  value,
  item,
  fixed,
  onPick,
  invalid = false,
  kind,
  requireStock = false,
}: {
  /** El id elegido, o `null`. */
  value: string | null;
  /** El artículo elegido, releído de su consulta (051). */
  item: InventoryItem | undefined;
  /** `true` si el artículo vino dado y no se puede cambiar. */
  fixed: boolean;
  onPick: (id: string) => void;
  invalid?: boolean;
  /** Solo artículos de este tipo. Sin esto, los dos. */
  kind?: InventoryItemKind;
  /** Deshabilita los que están en 0 o menos. */
  requireStock?: boolean;
}) {
  const uid = useId();
  const inputId = `${uid}-search`;
  const labelId = `${uid}-label`;
  const listId = `${uid}-list`;

  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  // La fila elegida sirve de respaldo mientras llega la consulta del artículo:
  // la tarjeta no parpadea a la búsqueda entre el clic y la respuesta.
  const [pickedRow, setPickedRow] = useState<InventoryItem | null>(null);
  const [focusAfter, setFocusAfter] = useState<'search' | 'change' | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  const searching = !fixed && (value === null || changing);
  const term = query.trim();
  const search = useDebouncedValue(term);
  const results = useInventoryItems(
    { kind, search: search === '' ? undefined : search, pageSize: PICKER_PAGE_SIZE },
    searching,
  );

  useEffect(() => {
    if (focusAfter === 'search') inputRef.current?.focus();
    if (focusAfter === 'change') changeRef.current?.focus();
    if (focusAfter !== null) setFocusAfter(null);
  }, [focusAfter]);

  const shown = item ?? (pickedRow !== null && pickedRow.id === value ? pickedRow : undefined);

  if (fixed) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-text-faint text-label">Artículo</p>
          <p className="text-text text-body font-semibold">
            {item?.name ?? 'Cargando…'}
            {item ? (
              <span className="text-text-faint ml-2 font-mono text-dense font-normal">
                {item.code}
              </span>
            ) : null}
          </p>
        </div>
        <StockLine item={item} />
      </div>
    );
  }

  if (!searching) {
    return (
      <div
        data-slot="item-picker-card"
        className="border-line bg-surface-2 flex items-center gap-3 rounded-control border px-(--field-px) pt-(--field-pt) pb-(--field-pb)"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-text-dim text-label">Artículo</span>
          <span className="text-text text-body font-semibold leading-tight">
            {shown?.name ?? 'Cargando…'}
            {shown ? (
              <span className="text-text-faint ml-2 font-mono text-dense font-normal">
                {shown.code}
              </span>
            ) : null}
          </span>
          {shown ? <StockText item={shown} /> : null}
        </div>
        <Button
          ref={changeRef}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setChanging(true);
            setQuery('');
            setActive(-1);
            setFocusAfter('search');
          }}
        >
          Cambiar
          <span className="sr-only"> el artículo</span>
        </Button>
      </div>
    );
  }

  const rows = results.data?.items ?? [];
  const disabled = rows.map((row) => requireStock && isOutOfStock(row.stockOnHand));
  const settled = search === term && !results.isFetching;
  const hidden = (results.data?.total ?? 0) - rows.length;
  const noun = NOUN[kind ?? 'ANY'];

  function pick(row: InventoryItem): void {
    setPickedRow(row);
    setChanging(false);
    setQuery('');
    setActive(-1);
    setFocusAfter('change');
    onPick(row.id);
  }

  function moveTo(index: number): void {
    setActive(index);
    const node = index < 0 ? null : document.getElementById(`${uid}-opt-${index}`);
    node?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(nextEnabledIndex(disabled, active, event.key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if (event.key === 'Enter') {
      // Enter en la búsqueda elige; nunca manda el formulario a medias.
      event.preventDefault();
      const index = enterPickIndex(disabled, active, settled);
      if (index >= 0) pick(rows[index]);
    }
  }

  const activeId = active >= 0 && active < rows.length ? `${uid}-opt-${active}` : undefined;

  return (
    <div data-slot="item-picker" className="flex flex-col gap-1.5">
      <FieldBox>
        <label htmlFor={inputId} id={labelId} data-slot="label" className="text-text-dim">
          Artículo
        </label>
        <div className="flex items-center gap-2">
          <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-invalid={invalid || undefined}
            value={query}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(-1);
            }}
            onKeyDown={handleKeyDown}
            className="text-text placeholder:text-text-faint min-w-0 flex-1 bg-transparent text-body outline-none"
          />
        </div>
      </FieldBox>

      {/* La lista es parte del diálogo: alto propio y scroll nativo, sin portal
          ni capa flotante (072). La rueda y el dedo la mueven. */}
      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        aria-busy={results.isFetching || undefined}
        className="border-line-soft bg-surface flex max-h-72 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-card border p-1 [[data-density=bahia]_&]:max-h-80"
      >
        {results.isPending ? (
          <PickerNote>Buscando…</PickerNote>
        ) : results.error ? (
          <PickerNote tone="danger">{results.error.message}</PickerNote>
        ) : rows.length === 0 ? (
          <PickerNote>
            {term === '' ? `No hay ${noun} activos todavía.` : `Sin coincidencias para «${term}».`}
          </PickerNote>
        ) : (
          rows.map((row, index) => {
            const isDisabled = disabled[index];
            const isSelected = row.id === value;
            return (
              <li
                key={row.id}
                id={`${uid}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                data-active={index === active ? 'true' : undefined}
                className={cn(
                  'flex min-h-touch items-center gap-2.5 rounded-control px-2.5 py-1.5 [[data-density=bahia]_&]:py-2.5',
                  isDisabled
                    ? 'cursor-not-allowed'
                    : 'hover:bg-surface-2 data-[active=true]:bg-surface-2 cursor-pointer',
                  isSelected && 'bg-surface-2',
                )}
                onPointerMove={() => {
                  if (!isDisabled && index !== active) setActive(index);
                }}
                // El foco se queda en la búsqueda: tocar una fila no la vacía.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!isDisabled) pick(row);
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span
                    className={cn(
                      'text-body',
                      isDisabled ? 'text-text-dim' : 'text-text',
                      isSelected ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {row.name}
                  </span>
                  {isDisabled ? (
                    <span className="text-text-dim text-dense font-semibold">Sin existencia</span>
                  ) : (
                    <span className="text-text-faint text-dense">
                      {kind === undefined
                        ? `${row.kind === 'PRODUCT' ? 'Producto' : 'Insumo'} · hay `
                        : 'Hay '}
                      {formatQuantityWithUnit(row.stockOnHand, row.unit)}
                      {row.isLowStock ? (
                        <span className="text-danger-text font-semibold"> · bajo mínimo</span>
                      ) : null}
                    </span>
                  )}
                </span>
                <span className="text-text-faint shrink-0 font-mono text-dense font-bold tabular-nums">
                  {row.code}
                </span>
                <Check
                  aria-hidden
                  strokeWidth={1.5}
                  className={cn(
                    'text-flame-text size-icon shrink-0',
                    isSelected ? 'visible' : 'invisible',
                  )}
                />
              </li>
            );
          })
        )}
        {rows.length > 0 && hidden > 0 ? (
          <PickerNote>
            {hidden === 1 ? 'Hay 1 más' : `Hay ${hidden} más`}: escribí parte del nombre o el código
            para acotar.
          </PickerNote>
        ) : null}
      </ul>
    </div>
  );
}

/** Una línea de la lista que no es opción: cargando, error, vacío, «hay más». */
function PickerNote({
  children,
  tone = 'faint',
}: {
  children: ReactNode;
  tone?: 'faint' | 'danger';
}) {
  return (
    <li
      role="presentation"
      className={cn(
        'flex min-h-touch items-center px-2.5 py-1.5 text-dense',
        tone === 'danger' ? 'text-danger-text' : 'text-text-faint',
      )}
    >
      {children}
    </li>
  );
}

/** «Existencia: 4 litro · bajo mínimo», dentro de la tarjeta del elegido. */
function StockText({ item }: { item: InventoryItem }) {
  return (
    <span className="text-text-dim text-dense">
      Existencia:{' '}
      <span
        className={
          item.isLowStock ? 'text-danger-text font-mono font-semibold' : 'text-text font-mono'
        }
      >
        {formatQuantityWithUnit(item.stockOnHand, item.unit)}
      </span>
      {item.isLowStock ? ' · bajo mínimo' : null}
      {item.isActive ? null : ' · inactivo'}
    </span>
  );
}
