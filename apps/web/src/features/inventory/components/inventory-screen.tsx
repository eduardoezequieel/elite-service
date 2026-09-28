'use client';

import { PERMISSIONS, type InventoryItem, type InventoryItemKind } from '@elite/shared';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  CupSoda,
  History,
  Search,
  Tags,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { OriginLink } from '@/components/app-shell/origin-link';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { formatMoney, formatQuantity, itemReference } from '../format';
import { useInventoryItems } from '../hooks/use-inventory';
import { inventoryListQuery, replaceQuery, type InventoryListState } from '../list-params';
import { ConsumptionDialog } from './consumption-dialog';
import { DispatchDialog } from './dispatch-dialog';
import { EntryDialog } from './entry-dialog';
import { ItemStatusStamp } from './movement-type-stamp';
import { Pager } from './pager';
import { ToggleChip } from './toggle-chip';

type ListDialog = 'entry' | 'dispatch' | 'consumption' | null;

const ICON = 'size-icon';

/**
 * `/inventory` (spec 065): productos que se venden en el lavado e insumos que
 * se despachan al equipo, en dos pestañas.
 *
 * La pestaña, la búsqueda y los filtros viven en la URL: la ficha que se abre
 * desde una fila vuelve acá con todo puesto (056).
 */
export function InventoryScreen({ initial }: { initial: InventoryListState }) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const canMove = can(PERMISSIONS.inventory.actions.move.key);

  const [state, setState] = useState<InventoryListState>(initial);
  const [term, setTerm] = useState(initial.search);
  const search = useDebouncedValue(term.trim());
  const [dialog, setDialog] = useState<ListDialog>(null);

  // La búsqueda asentada entra al estado y vuelve a la primera página.
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

  const items = useInventoryItems({
    kind: state.kind,
    search: state.search === '' ? undefined : state.search,
    lowStock: state.lowStock || undefined,
    includeInactive: state.includeInactive || undefined,
    page: state.page,
  });
  // Los recuentos de las pestañas y del filtro no dependen de la búsqueda.
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

  const isProduct = state.kind === 'PRODUCT';
  const rows = items.data?.items ?? [];
  const filtered = state.search !== '' || state.lowStock;
  const lowCount = low.data?.total ?? 0;
  const noun = isProduct ? 'productos' : 'insumos';

  // El alta vive en Catálogo (068): acá se lleva la existencia del día a día.
  const catalogButton = canManage ? (
    <Button asChild variant="outline">
      <Link href={`/settings/catalog?tab=${isProduct ? 'products' : 'supplies'}`}>
        <Tags className={ICON} strokeWidth={1.5} aria-hidden />
        Ir a Catálogo
      </Link>
    </Button>
  ) : null;

  const columns: DataTableColumn<InventoryItem>[] = [
    {
      key: 'name',
      header: 'Artículo',
      headerClassName: 'w-full',
      stack: 'title',
      className: 'whitespace-normal',
      cell: (item) => (
        <span className="flex flex-col leading-tight">
          <span className="text-text text-body font-semibold">{item.name}</span>
          <span className="text-text-faint font-mono text-label">{item.code}</span>
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      className: 'whitespace-nowrap',
      cell: (item) =>
        item.category === null ? (
          <span className="text-text-faint">—</span>
        ) : (
          <span className="text-text-dim">{item.category.name}</span>
        ),
    },
    {
      key: 'stock',
      header: 'Existencia',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (item) => (
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
      ),
    },
    {
      key: 'min',
      header: 'Mínimo',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (item) =>
        item.minStock === '0.000' ? (
          <span className="text-text-faint">—</span>
        ) : (
          <span className="text-text-dim font-mono">{formatQuantity(item.minStock)}</span>
        ),
    },
    ...(isProduct
      ? [
          {
            key: 'price',
            header: 'Precio',
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
      cell: (item) => <ItemStatusStamp isActive={item.isActive} isLowStock={item.isLowStock} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader
        title="Inventario"
        subtitle="Productos que se venden en el lavado e insumos que se despachan al equipo."
      >
        <Button asChild variant="outline">
          <OriginLink href="/inventory/movements">
            <History className={ICON} strokeWidth={1.5} aria-hidden />
            Movimientos
          </OriginLink>
        </Button>
        <Button asChild variant="outline">
          <OriginLink href="/inventory/consumption">
            <ClipboardList className={ICON} strokeWidth={1.5} aria-hidden />
            Consumo de empleados
          </OriginLink>
        </Button>
        {canMove ? (
          <>
            <Button type="button" variant="outline" onClick={() => setDialog('entry')}>
              <ArrowDownToLine className={ICON} strokeWidth={1.5} aria-hidden />
              Registrar entrada
            </Button>
            {/* Solo se despachan insumos (072): en Productos el botón no va. */}
            {isProduct ? null : (
              <Button type="button" variant="outline" onClick={() => setDialog('dispatch')}>
                <ArrowUpFromLine className={ICON} strokeWidth={1.5} aria-hidden />
                Despachar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setDialog('consumption')}>
              <CupSoda className={ICON} strokeWidth={1.5} aria-hidden />
              Consumo de empleado
            </Button>
          </>
        ) : null}
      </ScreenHeader>

      <Tabs<InventoryItemKind>
        aria-label="Tipo de artículo"
        value={state.kind}
        onValueChange={(kind) => update({ kind })}
        items={[
          { value: 'PRODUCT', label: 'Productos', count: products.data?.total },
          { value: 'SUPPLY', label: 'Insumos', count: supplies.data?.total },
        ]}
      />

      <div role="tabpanel" id={`tabpanel-${state.kind}`} aria-labelledby={`tab-${state.kind}`}>
        <div className="flex flex-col gap-4">
          <FilterBar>
            <div className="min-w-0 max-w-md flex-1 basis-64">
              <FieldBox className="h-full">
                <Label htmlFor="inventory-search">
                  Buscar por nombre, código o código de barras
                </Label>
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
                    placeholder={isProduct ? 'Cera o INV-0001' : 'Franela o INV-0007'}
                    autoComplete="off"
                  />
                </div>
              </FieldBox>
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
            <ToggleChip
              pressed={state.includeInactive}
              onPressedChange={(includeInactive) => update({ includeInactive })}
            >
              Ver inactivos
            </ToggleChip>
          </FilterBar>

          <DataTable
            rows={rows}
            rowKey={(item) => item.id}
            rowHref={(item) => `/inventory/${item.id}`}
            reference={(item) => itemReference(item.code)}
            isLoading={items.isPending}
            errorMessage={items.error?.message ?? null}
            emptyTitle={
              state.lowStock
                ? 'Nada bajo mínimo'
                : filtered
                  ? `Ningún artículo coincide con «${state.search}»`
                  : `Todavía no hay ${noun}`
            }
            emptyMessage={
              state.lowStock
                ? 'Cuando un artículo llegue a su mínimo va a aparecer acá.'
                : filtered
                  ? 'Probá con otra parte del nombre, el código INV o el código de barras.'
                  : isProduct
                    ? 'Los productos se venden como una línea más del lavado. Se dan de alta en Catálogo → Productos.'
                    : 'Los insumos se despachan al equipo desde la oficina. Se dan de alta en Catálogo → Insumos.'
            }
            emptyAction={filtered ? undefined : (catalogButton ?? undefined)}
            columns={columns}
          />

          <Pager
            page={items.data}
            noun={
              isProduct
                ? { one: 'producto', many: 'productos' }
                : { one: 'insumo', many: 'insumos' }
            }
            onPageChange={(page) => setState((previous) => ({ ...previous, page }))}
          />
        </div>
      </div>

      {dialog === 'entry' ? <EntryDialog itemId={null} onClose={() => setDialog(null)} /> : null}
      {dialog === 'dispatch' ? (
        <DispatchDialog itemId={null} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'consumption' ? (
        <ConsumptionDialog itemId={null} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
