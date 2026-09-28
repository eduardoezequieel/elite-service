'use client';

import type { InventoryItem, InventoryItemKind } from '@elite/shared';
import { useState } from 'react';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatMoney } from '@/lib/money';
import { formatQuantityWithUnit } from '@/lib/quantity';
import { useInventoryItems } from '../hooks/use-inventory';

/** Cuántas opciones trae la búsqueda: el resto se encuentra escribiendo. */
const PICKER_PAGE_SIZE = 20;

function optionOf(item: InventoryItem, onlyKind: boolean): ComboboxOption {
  const stock = formatQuantityWithUnit(item.stockOnHand, item.unit);

  return {
    value: item.id,
    label: item.name,
    meta: item.code,
    // Con un solo tipo en la lista, decir «Producto» en cada opción sobra; el
    // precio sí sirve, porque es lo que vale lo que se anota (070).
    hint: onlyKind
      ? `Hay ${stock}${item.kind === 'PRODUCT' ? ` · ${formatMoney(item.price)}` : ''}`
      : `${item.kind === 'PRODUCT' ? 'Producto' : 'Insumo'} · hay ${stock}`,
  };
}

/**
 * El artículo de un movimiento.
 *
 * Desde la ficha viene fijo y se muestra como texto —lo que no se edita no es
 * un control muerto—; desde la lista se busca por nombre, código o código de
 * barras contra el API (combobox de búsqueda, 034). Solo artículos activos: uno
 * inactivo no se mueve (RN-14). `kind` acota la búsqueda a un tipo: el consumo
 * de un empleado solo toma productos (070 RN-2).
 */
export function ItemField({
  item,
  fixed,
  onPick,
  invalid = false,
  kind,
}: {
  /** El artículo elegido, releído de su consulta. */
  item: InventoryItem | undefined;
  /** `true` si el artículo vino dado y no se puede cambiar. */
  fixed: boolean;
  onPick: (id: string) => void;
  invalid?: boolean;
  /** Solo artículos de este tipo. Sin esto, los dos. */
  kind?: InventoryItemKind;
}) {
  const [query, setQuery] = useState(item?.name ?? '');
  const search = useDebouncedValue(query.trim());
  const results = useInventoryItems(
    { kind, search: search === '' ? undefined : search, pageSize: PICKER_PAGE_SIZE },
    !fixed,
  );

  if (fixed) {
    return (
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
    );
  }

  const onlyKind = kind !== undefined;
  const options = (results.data?.items ?? []).map((result) => optionOf(result, onlyKind));
  // La opción elegida tiene que estar en la lista aunque la búsqueda ya no la traiga.
  if (item !== undefined && !options.some((option) => option.value === item.id)) {
    options.unshift(optionOf(item, onlyKind));
  }

  return (
    <Combobox
      mode="search"
      label="Artículo"
      placeholder="Nombre, código o código de barras"
      filter="off"
      query={query}
      onQueryChange={setQuery}
      options={options}
      value={item?.id ?? ''}
      invalid={invalid}
      emptyText={results.isPending ? 'Buscando…' : 'Sin coincidencias'}
      onChange={(value, option) => {
        setQuery(option.label);
        onPick(value);
      }}
    />
  );
}

/** «Existencia: 4 litro», debajo del artículo elegido. */
export function StockLine({ item }: { item: InventoryItem | undefined }) {
  if (item === undefined) return null;

  return (
    <p className="text-text-dim text-dense">
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
    </p>
  );
}
