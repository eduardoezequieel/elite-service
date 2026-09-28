'use client';

import { PERMISSIONS, type InventoryItemKind } from '@elite/shared';
import { FolderTree, Pencil, Plus, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ItemDialog } from '@/features/inventory/components/item-dialog';
import { Pager } from '@/features/inventory/components/pager';
import {
  useInventoryCategories,
  useInventoryItems,
} from '@/features/inventory/hooks/use-inventory';
import { categoriesHref } from '@/features/inventory/category-kind';
import { itemDefinitionRow, type ItemDefinitionRow } from '@/features/inventory/item-definitions';
import { ALL_FILTER, countActiveFilters, withAllOption } from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import type { CatalogTab } from '../catalog-tabs';
import { CatalogFrame } from './catalog-frame';

const ICON = 'size-icon';

const COPY: Record<
  InventoryItemKind,
  { subtitle: string; noun: { one: string; many: string }; empty: string; placeholder: string }
> = {
  PRODUCT: {
    subtitle: 'Productos que se venden en el lavado · la existencia se lleva en Inventario',
    noun: { one: 'producto', many: 'productos' },
    empty:
      'Los productos se venden como una línea más del lavado. Creá el primero con «Nuevo artículo».',
    placeholder: 'Cera o INV-0001',
  },
  SUPPLY: {
    subtitle: 'Insumos que se despachan al equipo · la existencia se lleva en Inventario',
    noun: { one: 'insumo', many: 'insumos' },
    empty:
      'Los insumos se despachan al equipo desde la oficina. Creá el primero con «Nuevo artículo».',
    placeholder: 'Franela o INV-0007',
  },
};

/**
 * Catálogo → Productos o Insumos (spec 068): la **definición** de cada
 * artículo —código, nombre, categoría, unidad, precio, mínimo, estado—, con el
 * alta y la edición del `ItemDialog` de la 065. La existencia y los movimientos
 * siguen en `/inventory`; la fila abre la ficha del artículo.
 *
 * Se listan también los inactivos: es la lista donde se reactivan.
 */
export function ItemDefinitionsPanel({
  tab,
  kind,
  tabs,
}: {
  tab: CatalogTab;
  kind: InventoryItemKind;
  tabs: ReactNode;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const copy = COPY[kind];
  const isProduct = kind === 'PRODUCT';

  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const extra = useFilterValues(['category'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const categoryId = extra.values.category === ALL_FILTER ? undefined : extra.values.category;
  // La página vale para el recorte con el que se eligió: otro recorte vuelve a la primera.
  const narrowedBy = `${search}|${categoryId ?? ''}`;
  const [paging, setPaging] = useState({ narrowedBy: '|', page: 1 });
  const page = paging.narrowedBy === narrowedBy ? paging.page : 1;
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = useInventoryItems({
    kind,
    search: search === '' ? undefined : search,
    categoryId,
    includeInactive: true,
    page,
  });
  // Las categorías son de productos o de insumos (072): solo las de esta pestaña.
  const categories = useInventoryCategories({ kind, includeInactive: true });
  const categoryOptions = useMemo(
    () =>
      withAllOption(
        'Todas las categorías',
        (categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
      ),
    [categories.data],
  );
  const loaded = useMemo(() => items.data?.items ?? [], [items.data]);
  const rows = useMemo(() => loaded.map(itemDefinitionRow), [loaded]);
  // Se guarda el id y el artículo se relee de la consulta (051).
  const editing = loaded.find((item) => item.id === editingId);
  const filtered = search !== '' || extraActive > 0;
  const hasItems = (items.data?.total ?? 0) > 0 || filtered;

  const newButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      <Plus className={ICON} strokeWidth={1.5} aria-hidden />
      Nuevo artículo
    </Button>
  ) : null;

  const columns: DataTableColumn<ItemDefinitionRow>[] = [
    {
      key: 'name',
      header: 'Artículo',
      headerClassName: 'w-full',
      stack: 'title',
      className: 'whitespace-normal',
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span
            className={cn('text-text text-body font-semibold', !row.isActive && 'is-ruled-out')}
          >
            {row.name}
          </span>
          <span className="text-text-faint font-mono text-label">{row.code}</span>
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.category === null ? (
          <span className="text-text-faint">—</span>
        ) : (
          <Stamp tone="queue" label={row.category} />
        ),
    },
    {
      key: 'unit',
      header: 'Unidad',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text-dim">{row.unit}</span>,
    },
    ...(isProduct
      ? [
          {
            key: 'price',
            header: 'Precio',
            align: 'right' as const,
            className: 'whitespace-nowrap',
            cell: (row: ItemDefinitionRow) => (
              <span className="text-text font-mono tabular-nums">{row.price}</span>
            ),
          },
        ]
      : []),
    {
      key: 'min',
      header: 'Mínimo',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.minStock === null ? (
          <span className="text-text-faint" title="Sin aviso de mínimo">
            —
          </span>
        ) : (
          <span className="text-text-dim font-mono tabular-nums">{row.minStock}</span>
        ),
    },
    {
      key: 'status',
      header: 'Estado',
      stack: 'aside',
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.isActive ? (
          <Stamp tone="green" label="Activo" />
        ) : (
          <Stamp tone="neutral" label="Inactivo" />
        ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions' as const,
            className: 'whitespace-nowrap',
            cell: (row: ItemDefinitionRow) => (
              <Button type="button" variant="outline" onClick={() => setEditingId(row.id)}>
                <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                Editar
                <span className="sr-only"> {row.name}</span>
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <CatalogFrame
      tab={tab}
      tabs={tabs}
      subtitle={copy.subtitle}
      actions={
        <>
          {canManage ? (
            <Button asChild variant="outline">
              <OriginLink href={categoriesHref(kind)}>
                <FolderTree className={ICON} strokeWidth={1.5} aria-hidden />
                Categorías
              </OriginLink>
            </Button>
          ) : null}
          {hasItems ? newButton : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FilterBar>
          <div className="min-w-0 max-w-md flex-1 basis-64">
            <FieldBox className="h-full">
              <Label htmlFor="catalog-item-search">
                Buscar por nombre, código o código de barras
              </Label>
              <div className="flex items-center gap-2">
                <Search
                  className="text-text-faint size-icon shrink-0"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <Input
                  id="catalog-item-search"
                  className="min-w-0 flex-1"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder={copy.placeholder}
                  autoComplete="off"
                />
              </div>
            </FieldBox>
          </div>
          <FiltersPopover
            fields={[
              {
                id: 'category',
                label: 'Categoría',
                value: extra.values.category,
                options: categoryOptions,
                onChange: (value) => extra.set('category', value),
              },
            ]}
            onReset={extra.reset}
          />
        </FilterBar>

        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          rowHref={(row) => `/inventory/${row.id}`}
          reference={(row) => row.reference}
          isLoading={items.isPending}
          errorMessage={items.error?.message ?? null}
          emptyTitle={
            search !== ''
              ? `Ningún artículo coincide con «${search}»`
              : filtered
                ? `No hay ${copy.noun.many} en esa categoría`
                : `Todavía no hay ${copy.noun.many}`
          }
          emptyMessage={
            search !== ''
              ? 'Probá con otra parte del nombre, el código INV o el código de barras.'
              : filtered
                ? 'Elegí otra categoría o restablecé los filtros.'
                : copy.empty
          }
          emptyAction={filtered ? undefined : (newButton ?? undefined)}
          columns={columns}
        />

        <Pager
          page={items.data}
          noun={copy.noun}
          onPageChange={(next) => setPaging({ narrowedBy, page: next })}
        />
      </div>

      {creating ? <ItemDialog initialKind={kind} onClose={() => setCreating(false)} /> : null}
      {editing === undefined ? null : (
        <ItemDialog key={editing.id} item={editing} onClose={() => setEditingId(null)} />
      )}
    </CatalogFrame>
  );
}
