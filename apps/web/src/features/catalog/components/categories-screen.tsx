'use client';

import { PERMISSIONS, createServiceCategorySchema } from '@elite/shared';
import type { ServiceCategorySummary } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { FieldBox } from '@/components/ui/field-box';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Stamp } from '@/components/ui/stamp';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCatalogCategories, useCreateCategory, useUpdateCategory } from '../hooks/use-catalog';

/**
 * Lista mínima de categorías: crear una para poder dar de alta un servicio.
 */
export function CategoriesScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const categories = useCatalogCategories();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ServiceCategorySummary | null>(null);
  const rows = categories.data ?? [];

  const newButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nueva categoría
    </Button>
  ) : null;

  return (
    <div>
      <ScreenHeader title="Categorías" subtitle="Las usa el catálogo de servicios">
        {rows.length > 0 ? newButton : null}
      </ScreenHeader>

      <DataTable
        rows={rows}
        rowKey={(category) => category.id}
        isLoading={categories.isPending}
        errorMessage={categories.error?.message ?? null}
        emptyTitle="Todavía no hay categorías"
        emptyMessage="Creá la primera para poder dar de alta un servicio."
        emptyAction={rows.length === 0 ? newButton : undefined}
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
            cell: (category: ServiceCategorySummary) =>
              category.isActive ? (
                <Stamp tone="queue" label="Activa" />
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
                  cell: (category: ServiceCategorySummary) => (
                    <Button type="button" variant="outline" onClick={() => setEditing(category)}>
                      <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                      Editar
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryDialog category={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

const categoryFormSchema = z.object({
  name: createServiceCategorySchema.shape.name,
  isActive: z.boolean(),
});

type CategoryFormValues = z.input<typeof categoryFormSchema>;
type CategoryFormOutput = z.output<typeof categoryFormSchema>;

function CategoryDialog({
  category,
  onClose,
}: {
  category?: ServiceCategorySummary;
  onClose: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const { toast } = useToast();
  const isNew = category === undefined;
  const form = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categoryFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: category?.name ?? '',
      isActive: category?.isActive ?? true,
    },
  });
  const name = form.watch('name');
  const complete = name.trim() !== '';
  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;

  const submit = form.handleSubmit((values) => {
    if (isNew) {
      create.mutate(
        { name: values.name },
        {
          onSuccess: (saved) => {
            toast({ title: 'Categoría creada', description: saved.name });
            onClose();
          },
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
      },
    );
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={submit}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>{isNew ? 'Nueva categoría' : 'Editar categoría'}</DialogTitle>
              <DialogDescription>El nombre con el que agrupás los servicios.</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FieldBox>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input id="category-name" autoComplete="off" {...field} />
                      </FormControl>
                    </FieldBox>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isNew ? null : (
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                        <FormLabel>Activa</FormLabel>
                        <FormControl>
                          <Switch
                            id="category-active"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {error ? (
                <p className="text-danger-text text-body" role="alert">
                  {error.message}
                </p>
              ) : null}
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
