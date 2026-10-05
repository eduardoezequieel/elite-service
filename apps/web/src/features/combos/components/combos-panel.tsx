'use client';

import { PERMISSIONS, type ComboDetail } from '@elite/shared';
import { Copy, Pause, Pencil, Play, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { CatalogFrame } from '@/features/catalog/components/catalog-frame';
import { useCatalogBodyTypes } from '@/features/catalog/hooks/use-catalog';
import { Pager } from '@/features/inventory/components/pager';
import { itemReference } from '@/features/inventory/format';
import { todayCivil } from '@/lib/civil-date';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import {
  COMBO_STATUS_FILTERS,
  COMBO_STATUS_LABELS,
  COMBO_STATUS_TONES,
  comboPriceViews,
  comboStatusParam,
  componentsLabel,
  outOfStockLabel,
  whenLabel,
  type ComboStatusFilter,
} from '../combo-format';
import { comboFormOf, emptyComboForm, type ComboFormValues } from '../combo-draft';
import { useCombos, useUpdateCombo } from '../hooks/use-combos';
import { ComboDialog } from './combo-dialog';
import { Segmented } from './segmented';

/** Qué tiene abierto el editor: un combo nuevo, uno a editar o uno a duplicar. */
type EditorState = { title: string; comboId: string | null; initial: ComboFormValues } | null;

/**
 * Catálogo → Combos (104). Búsqueda con respiro, filtro por estado y la lista
 * de a una página. Sin `combos.manage` es solo lectura: sin «Nuevo combo» y
 * sin la columna de acciones.
 */
export function CombosPanel({ tabs }: { tabs: ReactNode }) {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.combos.actions.read.key);
  const canManage = can(PERMISSIONS.combos.actions.manage.key);
  const bodyTypes = useCatalogBodyTypes(canRead);
  const update = useUpdateCombo();
  const { toast } = useToast();
  const today = todayCivil();

  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const [status, setStatus] = useState<ComboStatusFilter>('all');
  const narrowedBy = `${search}|${status}`;
  const [paging, setPaging] = useState({ narrowedBy, page: 1 });
  const page = paging.narrowedBy === narrowedBy ? paging.page : 1;
  const combos = useCombos(
    {
      search: search === '' ? undefined : search,
      status: comboStatusParam(status),
      page,
      pageSize: LIST_PAGE_SIZE,
    },
    canRead,
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const narrowing = search !== '' || status !== 'all';
  const types = bodyTypes.data ?? [];

  const toggling = update.isPending ? (update.variables?.id ?? null) : null;

  function toggleActive(combo: ComboDetail): void {
    const isActive = !combo.isActive;

    update.mutate(
      { id: combo.id, input: { isActive } },
      {
        onSuccess: () =>
          toast({ title: isActive ? 'Combo activado' : 'Combo pausado', description: combo.name }),
      },
    );
  }

  const newButton = canManage ? (
    <Button
      type="button"
      onClick={() =>
        setEditor({ title: 'Nuevo combo', comboId: null, initial: emptyComboForm(today) })
      }
    >
      <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
      Nuevo combo
    </Button>
  ) : null;

  return (
    <CatalogFrame tab="combos" tabs={tabs} subtitle={null} actions={newButton}>
      <FilterBar className="mb-4">
        <div className="min-w-0 max-w-md flex-1 basis-60">
          <FieldBox className="h-full">
            <Label htmlFor="combos-search">Buscar</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="combos-search"
                type="search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>
          </FieldBox>
        </div>
        <Segmented
          aria-label="Estado"
          items={COMBO_STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          className="max-sm:w-full"
        />
      </FilterBar>

      {update.error ? (
        <p className="text-danger-text text-body mb-3" role="alert">
          {update.error.message}
        </p>
      ) : null}

      <DataTable
        rows={combos.data?.items ?? []}
        rowKey={(combo) => combo.id}
        reference={(combo) => itemReference(combo.code)}
        isLoading={combos.isPending}
        errorMessage={combos.error?.message ?? null}
        emptyTitle={narrowing ? 'Nada coincide' : 'Sin combos'}
        emptyMessage={narrowing ? 'Probá con otra búsqueda.' : ''}
        emptyAction={narrowing ? undefined : (newButton ?? undefined)}
        columns={[
          {
            key: 'combo',
            header: 'Combo',
            headerClassName: 'w-full',
            className: 'whitespace-normal',
            stack: 'title',
            cell: (combo) => (
              <span className="block min-w-0">
                <span className="text-text text-body block font-semibold">{combo.name}</span>
                <span className="text-text-dim block text-dense">
                  {componentsLabel(combo.items)}
                </span>
              </span>
            ),
          },
          {
            key: 'when',
            header: 'Vigencia',
            className: 'whitespace-nowrap',
            cell: (combo) => (
              <span className="text-text-dim text-dense">{whenLabel(combo, today)}</span>
            ),
          },
          {
            key: 'price',
            header: 'Precio',
            align: 'right',
            className: 'whitespace-nowrap',
            cell: (combo) => (
              <span className="flex flex-col items-end gap-0.5">
                {comboPriceViews(combo.prices, types).map((view) => (
                  <span
                    key={view.bodyTypeName ?? 'all'}
                    className="flex items-baseline gap-2 tabular-nums"
                  >
                    {view.bodyTypeName === null ? null : (
                      <span className="text-text-faint text-dense">{view.bodyTypeName}</span>
                    )}
                    <span className="text-text font-mono font-semibold">{view.price}</span>
                    {view.saving === null ? null : (
                      <span className="text-go-text font-mono text-dense">{view.saving}</span>
                    )}
                  </span>
                ))}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (combo) => {
              const missing = outOfStockLabel(combo.outOfStock);

              return (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Stamp
                    tone={COMBO_STATUS_TONES[combo.status]}
                    label={COMBO_STATUS_LABELS[combo.status]}
                  />
                  {missing === null ? null : <Stamp tone="amber" label={missing} />}
                </span>
              );
            },
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (combo: ComboDetail) => (
                    <span className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setEditor({
                            title: 'Editar combo',
                            comboId: combo.id,
                            initial: comboFormOf(combo, 'edit'),
                          })
                        }
                      >
                        <Pencil
                          className="text-text-faint size-3.5"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                        Editar
                        <span className="sr-only"> {combo.name}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setEditor({
                            title: 'Duplicar combo',
                            comboId: null,
                            initial: comboFormOf(combo, 'duplicate'),
                          })
                        }
                      >
                        <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
                        Duplicar
                        <span className="sr-only"> {combo.name}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        loading={toggling === combo.id}
                        disabled={toggling !== null}
                        onClick={() => toggleActive(combo)}
                      >
                        {combo.isActive ? (
                          <Pause className="size-3.5" strokeWidth={1.5} aria-hidden />
                        ) : (
                          <Play className="size-3.5" strokeWidth={1.5} aria-hidden />
                        )}
                        {combo.isActive ? 'Pausar' : 'Activar'}
                        <span className="sr-only"> {combo.name}</span>
                      </Button>
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />

      <div className="mt-4">
        <Pager
          page={combos.data}
          noun={{ one: 'combo', many: 'combos' }}
          onPageChange={(next) => setPaging({ narrowedBy, page: next })}
        />
      </div>

      {editor === null ? null : (
        <ComboDialog
          key={`${editor.title}-${editor.comboId ?? 'new'}`}
          title={editor.title}
          comboId={editor.comboId}
          initial={editor.initial}
          bodyTypes={types}
          onClose={() => setEditor(null)}
        />
      )}
    </CatalogFrame>
  );
}
