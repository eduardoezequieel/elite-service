'use client';

import { PERMISSIONS, type InventoryItem, type InventoryItemKind } from '@elite/shared';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ALL_FILTER, isAll, withAllOption } from '@/lib/list-filters';
import { replaceQuery } from '@/lib/list-params';
import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/quantity';
import { itemReference } from '../format';
import { useInventoryCategories, useInventoryItems } from '../hooks/use-inventory';
import { inventoryListQuery, type InventoryListState } from '../list-params';
import { InventoryFrame } from './inventory-frame';
import { Pager } from './pager';
import { QuickEntryRow } from './quick-entry-row';
import { ToggleChip } from './toggle-chip';

const ICON = 'size-icon';

/** El valor de «Mostrar» que suma los inactivos; el otro es `ALL_FILTER` (solo activos). */
const WITH_INACTIVE = 'with-inactive';

const KINDS: readonly { value: InventoryItemKind; label: string }[] = [
  { value: 'PRODUCT', label: 'Productos' },
  { value: 'SUPPLY', label: 'Insumos' },
];

/**
 * `/inventory` → Existencias (065, rediseño 091): lo que hay de cada artículo.
 *
 * Productos / Insumos es un selector de la barra, no una pestaña: las pestañas
 * son las tres vistas del inventario. Categoría e «inactivos» van en Filtros.
 * La fila dice el nombre, su categoría y código, cuánto hay y su mínimo, y el
 * precio de venta si se vende; el chip solo sale cuando dice algo.
 *
 * El «+» de la existencia abre debajo la entrada rápida. Entregar va arriba,
 * en la cabecera: una entrega casi nunca es de un solo artículo.
 *
 * Todo el estado vive en la URL: la ficha que se abre desde una fila vuelve acá
 * con todo puesto (056).
 */
export function InventoryScreen({ initial }: { initial: InventoryListState }) {
  const { can } = usePermissions();
  const canMove = can(PERMISSIONS.inventory.actions.move.key);
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);

  const [state, setState] = useState<InventoryListState>(initial);
  const [term, setTerm] = useState(initial.search);
  const search = useDebouncedValue(term.trim());
  const [entryFor, setEntryFor] = useState<string | null>(null);

  useEffect(() => {
    setState((previous) =>
      previous.search === search ? previous : { ...previous, search, page: 1 },
    );
  }, [search]);

  useEffect(() => {
    replaceQuery(inventoryListQuery(state));
  }, [state]);

  const update = (patch: Partial<InventoryListState>) =>
    setState((previous) => ({ ...previous, page: 1, ...patch }));

  const categoryId = isAll(state.categoryId) ? undefined : state.categoryId;
  const items = useInventoryItems({
    kind: state.kind,
    search: state.search === '' ? undefined : state.search,
    categoryId,
    lowStock: state.lowStock || undefined,
    includeInactive: state.includeInactive || undefined,
    page: state.page,
  });
  // Las cuentas del selector y de «Bajo mínimo» no dependen de la búsqueda.
  const products = useInventoryItems({
    kind: 'PRODUCT',
    includeInactive: state.includeInactive || undefined,
    pageSize: 1,
  });
  const supplies = useInventoryItems({
    kind: 'SUPPLY',
    includeInactive: state.includeInactive || undefined,
    pageSize: 1,
  });
  const low = useInventoryItems({ kind: state.kind, lowStock: true, pageSize: 1 });
  const categories = useInventoryCategories({ kind: state.kind });

  const isProduct = state.kind === 'PRODUCT';
  const rows = items.data?.items ?? [];
  const filtered = state.search !== '' || state.lowStock || categoryId !== undefined;
  const lowCount = low.data?.total ?? 0;
  const counts: Record<InventoryItemKind, number | undefined> = {
    PRODUCT: products.data?.total,
    SUPPLY: supplies.data?.total,
  };
  const noun = isProduct ? 'productos' : 'insumos';

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Artículo',
      headerClassName: 'w-full',
      stack: 'title',
      className: 'whitespace-normal',
      cell: (item) => (
        <span className="flex flex-col leading-tight">
          <span className="text-text text-body font-semibold [[data-density=bahia]_&]:text-title">
            {item.name}
          </span>
          <span className="text-text-faint text-label">
            {item.category?.name ?? 'Sin categoría'} ·{' '}
            <span className="font-mono">{item.code}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'Existencia',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (item) => (
        <span className="inline-flex items-center justify-end gap-3">
          <span className="flex flex-col items-end leading-tight">
            <span>
              <span
                className={cn(
                  'font-mono [[data-density=bahia]_&]:text-body',
                  item.isLowStock ? 'text-danger-text font-bold' : 'text-text font-semibold',
                )}
              >
                {formatQuantity(item.stockOnHand)}
              </span>
              <span className="text-text-faint ml-1 text-label">{item.unit}</span>
            </span>
            <span className="text-text-faint text-label">
              {item.minStock === '0.000' ? 'sin mínimo' : `mínimo ${formatQuantity(item.minStock)}`}
            </span>
          </span>
          {/* 091: la entrada se suma desde la propia existencia. */}
          {canMove && item.isActive ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-expanded={entryFor === item.id}
              aria-label={`Sumar entrada de ${item.name}`}
              title="Sumar entrada"
              className={cn(entryFor === item.id && 'border-flame text-flame-text')}
              onClick={() => setEntryFor((current) => (current === item.id ? null : item.id))}
            >
              <Plus className={ICON} strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
        </span>
      ),
    },
    // Lo que paga el cliente; se fija en Catálogo. Un insumo no se vende: no lleva (091 RN-6).
    ...(isProduct
      ? [
          {
            key: 'price',
            header: 'Precio de venta',
            align: 'right' as const,
            className: 'whitespace-nowrap',
            cell: (item: InventoryItem) => (
              <span className="text-text font-mono">{formatMoney(item.price)}</span>
            ),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Estado',
      stack: 'aside',
      className: 'whitespace-nowrap',
      // «Activo» en cada fila era ruido: el chip sale solo cuando dice algo (091).
      cell: (item) =>
        !item.isActive ? (
          <Stamp tone="neutral" label="Inactivo" />
        ) : item.isLowStock ? (
          <Stamp tone="red" label="Bajo mínimo" />
        ) : null,
    },
  ];

  return (
    <InventoryFrame section="stock">
      <div className="flex flex-col gap-4">
        <FilterBar>
          <div className="min-w-0 max-w-md flex-1 basis-64">
            <FieldBox className="h-full">
              <Label htmlFor="inventory-search">Buscar</Label>
              <div className="flex items-center gap-2">
                <Search
                  className="text-text-faint size-icon shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <Input
                  id="inventory-search"
                  className="min-w-0 flex-1"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Nombre, código INV o código de barras"
                  autoComplete="off"
                />
              </div>
            </FieldBox>
          </div>

          <div
            role="group"
            aria-label="Tipo de artículo"
            className="border-line bg-surface-2 flex shrink-0 items-stretch gap-0.75 self-stretch rounded-control border p-0.75"
          >
            {KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={state.kind === option.value}
                onClick={() => {
                  setEntryFor(null);
                  update({ kind: option.value, categoryId: ALL_FILTER });
                }}
                className={cn(
                  'inline-flex min-h-(--touch-min) cursor-pointer items-center gap-2 rounded-(--segment-radius) border px-3.5 font-semibold',
                  'transition-colors duration-(--duration-state) ease-standard [[data-density=bahia]_&]:px-5',
                  state.kind === option.value
                    ? 'border-line bg-surface text-text'
                    : 'text-text-dim hover:text-text border-transparent',
                )}
              >
                {option.label}
                {counts[option.value] === undefined ? null : (
                  <span className="text-text-faint font-mono text-label tabular-nums">
                    {counts[option.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ToggleChip
            tone="danger"
            pressed={state.lowStock}
            onPressedChange={(lowStock) => update({ lowStock })}
          >
            Bajo mínimo
            {lowCount > 0 ? (
              <span className="text-danger-text tabular-nums">· {lowCount}</span>
            ) : null}
          </ToggleChip>

          <FiltersPopover
            fields={[
              {
                id: 'category',
                label: 'Categoría',
                value: state.categoryId,
                options: withAllOption(
                  'Todas las categorías',
                  (categories.data ?? []).map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ),
                onChange: (value) => update({ categoryId: value }),
              },
              {
                id: 'inactive',
                label: 'Mostrar',
                value: state.includeInactive ? WITH_INACTIVE : ALL_FILTER,
                options: [
                  { value: ALL_FILTER, label: 'Solo activos' },
                  { value: WITH_INACTIVE, label: 'También los inactivos' },
                ],
                onChange: (value) => update({ includeInactive: value === WITH_INACTIVE }),
              },
            ]}
            onReset={() => update({ categoryId: ALL_FILTER, includeInactive: false })}
          />
        </FilterBar>

        <DataTable
          rows={rows}
          rowKey={(item) => item.id}
          rowHref={(item) => `/inventory/${item.id}`}
          reference={(item) => itemReference(item.code)}
          isLoading={items.isPending}
          errorMessage={items.error?.message ?? null}
          renderExpanded={(item) =>
            entryFor === item.id ? (
              <QuickEntryRow item={item} onClose={() => setEntryFor(null)} />
            ) : null
          }
          emptyTitle={
            state.lowStock
              ? 'Nada bajo mínimo'
              : filtered
                ? state.search === ''
                  ? 'Ningún artículo coincide'
                  : `Ningún artículo coincide con «${state.search}»`
                : `Todavía no hay ${noun}`
          }
          emptyMessage={
            state.lowStock
              ? 'Cuando un artículo llegue a su mínimo va a aparecer acá.'
              : filtered
                ? 'Probá con otra parte del nombre, el código INV o el código de barras, o restablecé los filtros.'
                : `Los ${noun} se dan de alta en Catálogo; acá se lleva cuánto hay.`
          }
          emptyAction={
            filtered || !canManage ? undefined : (
              <Button asChild variant="outline">
                <Link href={`/settings/catalog?tab=${isProduct ? 'products' : 'supplies'}`}>
                  Ir a Catálogo
                </Link>
              </Button>
            )
          }
          columns={columns}
        />

        <Pager
          page={items.data}
          noun={
            isProduct ? { one: 'producto', many: 'productos' } : { one: 'insumo', many: 'insumos' }
          }
          onPageChange={(page) => setState((previous) => ({ ...previous, page }))}
        />
      </div>
    </InventoryFrame>
  );
}
