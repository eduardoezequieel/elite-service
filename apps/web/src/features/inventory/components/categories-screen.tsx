'use client';

import { PERMISSIONS, createInventoryCategorySchema, type InventoryCategory } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { activityOptions, countActiveFilters, matchesActivity } from '@/lib/list-filters';
import {
  useCreateInventoryCategory,
  useInventoryCategories,
  useUpdateInventoryCategory,
} from '../hooks/use-inventory';
import { applyInventoryError } from './form-error';
import { FormAlert, TextField } from './form-fields';

/**
 * `/settings/inventory/categories` (spec 065 RN-16): las categorías propias
 * del inventario —no las de servicios—, igual que la pantalla de la 016.
 * Se desactivan, no se borran (RN-14).
 */
export function InventoryCategoriesScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.inventory.actions.manage.key);
  const categories = useInventoryCategories(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const extra = useFilterValues(['active'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const all = useMemo(() => categories.data ?? [], [categories.data]);
  const rows = useMemo(
    () => all.filter((category) => matchesActivity(category.isActive, extra.values.active)),
    [all, extra.values.active],
  );
  // Se guarda el id y la categoría se relee de la consulta (051).
  const editing = all.find((category) => category.id === editingId);

  const newButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nueva categoría
    </Button>
  ) : null;

  return (
    <div>
      <ScreenHeader title="Categorías de inventario" subtitle="Agrupan productos e insumos">
        {all.length > 0 ? newButton : null}
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
        isLoading={categories.isPending}
        errorMessage={categories.error?.message ?? null}
        emptyTitle={extraActive > 0 ? 'Ninguna categoría coincide' : 'Todavía no hay categorías'}
        emptyMessage={
          extraActive > 0
            ? 'Nada coincide con esos filtros. Restablecelos o cambialos.'
            : 'Creá la primera para ordenar productos e insumos: ceras, químicos, limpieza…'
        }
        emptyAction={all.length === 0 ? newButton : undefined}
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

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryDialog category={editing} onClose={() => setEditingId(null)} /> : null}
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
  category,
  onClose,
}: {
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
        { name: values.name },
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
            <DialogDescription>El nombre con el que agrupás productos e insumos.</DialogDescription>
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
