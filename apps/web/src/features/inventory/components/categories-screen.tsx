'use client';

import {
  PERMISSIONS,
  createInventoryCategorySchema,
  type InventoryCategory,
  type InventoryItemKind,
} from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { activityFlag, activityOptions, countActiveFilters } from '@/lib/list-filters';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { pagedReference } from '../format';
import {
  useCreateInventoryCategory,
  useInventoryCategoriesPage,
  useUpdateInventoryCategory,
} from '../hooks/use-inventory';
import { useListPage } from '../hooks/use-list-page';
import { Pager } from './pager';
import { applyInventoryError } from './form-error';
import { FormAlert, TextField } from './form-fields';

const COPY: Record<
  InventoryItemKind,
  { title: string; subtitle: string; empty: string; dialog: string }
> = {
  PRODUCT: {
    title: 'Categorías de productos',
    subtitle: 'Agrupan lo que se vende en el lavado',
    empty: 'Creá la primera para ordenar los productos: ceras, aromatizantes, bebidas…',
    dialog: 'El nombre con el que agrupás productos. Solo la ven los productos.',
  },
  SUPPLY: {
    title: 'Categorías de insumos',
    subtitle: 'Agrupan lo que se despacha al equipo',
    empty: 'Creá la primera para ordenar los insumos: químicos, franelas, limpieza…',
    dialog: 'El nombre con el que agrupás insumos. Solo la ven los insumos.',
  },
};

/**
 * `/settings/inventory/categories?kind=products|supplies` (spec 065 RN-16,
 * 072): las categorías propias del inventario —no las de servicios—, igual que
 * la pantalla de la 016, de un tipo a la vez. El tipo se fija al crear y no
 * cambia. Se desactivan, no se borran (RN-14). El regreso a la pestaña de
 * Catálogo lo trae el `?from=` del botón «Categorías» (056).
 */
export function InventoryCategoriesScreen({
  kind,
  initialPage = 1,
}: {
  kind: InventoryItemKind;
  initialPage?: number;
}) {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const copy = COPY[kind];
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const extra = useFilterValues(['active'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  // El estado lo filtra el API (102): la página ya viene recortada.
  const [page, setPage] = useListPage(initialPage, `${kind}|${extra.values.active}`);
  const active = activityFlag(extra.values.active);
  const categories = useInventoryCategoriesPage({
    kind,
    includeInactive: active === undefined,
    active,
    page,
    pageSize: LIST_PAGE_SIZE,
  });
  // ¿Hay alguna del tipo? Sin filtro: decide si el botón va arriba o en el vacío.
  const any = useInventoryCategoriesPage({ kind, includeInactive: true, pageSize: 1 });
  const hasAny = (any.data?.total ?? 0) > 0;
  const rows = categories.data?.items ?? [];
  // Se guarda el id y la categoría se relee de la consulta (051).
  const editing = rows.find((category) => category.id === editingId);

  const newButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nueva categoría
    </Button>
  ) : null;

  return (
    <div>
      <ScreenHeader title={copy.title} subtitle={copy.subtitle}>
        {hasAny ? newButton : null}
      </ScreenHeader>

      <FilterBar className="mb-4">
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los estados', 'Activas', 'Inactivas'),
              onChange: (value) => extra.set('active', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <DataTable
        rows={rows}
        rowKey={(category) => category.id}
        reference={(_category, index) => pagedReference(categories.data, index)}
        isLoading={categories.isPending}
        errorMessage={categories.error?.message ?? null}
        emptyTitle={extraActive > 0 ? 'Ninguna categoría coincide' : 'Todavía no hay categorías'}
        emptyMessage={
          extraActive > 0
            ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
            : copy.empty
        }
        emptyAction={any.data !== undefined && !hasAny ? newButton : undefined}
        columns={[
          {
            key: 'name',
            header: 'Categoría',
            headerClassName: 'w-full',
            stack: 'title',
            cell: (category) => <span className="text-body font-semibold">{category.name}</span>,
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (category: InventoryCategory) =>
              category.isActive ? (
                <Stamp tone="green" label="Activa" />
              ) : (
                <Stamp tone="neutral" label="Inactiva" />
              ),
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (category: InventoryCategory) => (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingId(category.id)}
                    >
                      <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                      Editar
                      <span className="sr-only"> {category.name}</span>
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      <div className="mt-4">
        <Pager
          page={categories.data}
          noun={{ one: 'categoría', many: 'categorías' }}
          onPageChange={setPage}
        />
      </div>

      {creating ? <CategoryDialog kind={kind} onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <CategoryDialog kind={kind} category={editing} onClose={() => setEditingId(null)} />
      ) : null}
    </div>
  );
}

const categoryFormSchema = z.object({
  name: createInventoryCategorySchema.shape.name,
  isActive: z.boolean(),
});

type CategoryFormValues = z.input<typeof categoryFormSchema>;
type CategoryFormOutput = z.output<typeof categoryFormSchema>;

function CategoryDialog({
  kind,
  category,
  onClose,
}: {
  /** El tipo de la pantalla: con él nace la categoría nueva (072). */
  kind: InventoryItemKind;
  category?: InventoryCategory;
  onClose: () => void;
}) {
  const create = useCreateInventoryCategory();
  const update = useUpdateInventoryCategory();
  const { toast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const isNew = category === undefined;
  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? '', isActive: category?.isActive ?? true },
  });
  const isPending = create.isPending || update.isPending;
  const complete = form.watch('name').trim() !== '';

  const onError = (error: Parameters<typeof applyInventoryError>[0]) =>
    setFormError(applyInventoryError(error, form.setError, ['name']));

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    if (isNew) {
      create.mutate(
        { kind, name: values.name },
        {
          onSuccess: (saved) => {
            toast({ title: 'Categoría creada', description: saved.name });
            onClose();
          },
          onError,
        },
      );
      return;
    }

    update.mutate(
      { id: category.id, input: { name: values.name, isActive: values.isActive } },
      {
        onSuccess: (saved) => {
          toast({ title: 'Categoría guardada', description: saved.name });
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{isNew ? 'Nueva categoría' : 'Editar categoría'}</DialogTitle>
            <DialogDescription>{COPY[kind].dialog}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <TextField
              id="inventory-category-name"
              label="Nombre"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />

            {isNew ? null : (
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                    <label htmlFor="inventory-category-active" className="text-body font-semibold">
                      Activa
                    </label>
                    <Switch
                      id="inventory-category-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            )}

            <FormAlert message={formError} />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={isPending}>
              {isNew ? 'Crear categoría' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
