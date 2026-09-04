'use client';

import { PERMISSIONS } from '@elite/shared';
import type { ServiceCategorySummary } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Stamp } from '@/components/ui/stamp';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCatalogCategories, useCreateCategory } from '../hooks/use-catalog';

/**
 * Lista mínima de categorías: crear una para poder dar de alta un servicio.
 */
export function CategoriesScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.services.actions.manage.key);
  const categories = useCatalogCategories();
  const [creating, setCreating] = useState(false);
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
            cell: (category) => (
              <span className="text-body font-semibold">{category.name}</span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (category: ServiceCategorySummary) =>
              category.isActive ? (
                <Stamp tone="green" label="Activa" />
              ) : (
                <Stamp tone="neutral" label="Inactiva" />
              ),
          },
        ]}
      />

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

function CategoryDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateCategory();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const complete = name.trim() !== '';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete) return;

            create.mutate(
              { name: name.trim() },
              {
                onSuccess: (category) => {
                  toast({ title: 'Categoría creada', description: category.name });
                  onClose();
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>El nombre con el que agrupás los servicios.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <FieldBox>
              <Label htmlFor="category-name">Nombre</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </FieldBox>

            {create.error ? (
              <p className="text-danger-text text-body" role="alert">
                {create.error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={create.isPending}>
              Crear categoría
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
