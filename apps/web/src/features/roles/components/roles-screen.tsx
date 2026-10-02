'use client';

import { useState } from 'react';
import type { RoleDetail } from '@elite/shared';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useRoles } from '../hooks/use-roles';
import { DeleteRoleDialog } from './delete-role-dialog';
import { RoleFormDialog } from './role-form-dialog';
import { RolesTable } from './roles-table';

/**
 * `/settings/roles` — la pantalla de roles y permisos.
 *
 * Visible con `roles.read`; las acciones exigen `roles.manage`. Sin ese
 * permiso no aparece el boton de crear ni la accion de eliminar, y el diálogo
 * del rol se abre en solo lectura: nunca un control muerto (RN-1, DESIGN.md →
 * «ocultar lo que no se puede ver, texto plano lo que no se puede editar»).
 */
export function RolesScreen({ initialPage = 1 }: { initialPage?: number }) {
  const { can, isLoading: isSessionLoading } = usePermissions();
  const canRead = can('roles.read');
  const canManage = can('roles.manage');

  const [activeRole, setActiveRole] = useState<RoleDetail | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';
  // La búsqueda la resuelve el API (102): la página ya viene recortada.
  const [page, setPage] = useListPage(initialPage, search);
  const rolesQuery = useRoles(
    { search: searching ? search : undefined, page, pageSize: LIST_PAGE_SIZE },
    canRead,
  );
  // ¿Hay alguno? Sin búsqueda: decide si el botón va arriba o en el vacío.
  const any = useRoles({ pageSize: 1 }, canRead);
  const hasAny = (any.data?.total ?? 0) > 0;

  function openCreate() {
    setActiveRole(null);
    setFormOpen(true);
  }

  function openRole(role: RoleDetail) {
    setActiveRole(role);
    setFormOpen(true);
  }

  function openDelete(role: RoleDetail) {
    setActiveRole(role);
    setDeleteOpen(true);
  }

  if (!isSessionLoading && !canRead) {
    return (
      <section>
        <ScreenHeader title="Roles y permisos" />
        <p className="text-body text-text-dim">No tenés permiso para ver los roles del sistema.</p>
      </section>
    );
  }

  return (
    <section>
      <ScreenHeader title="Roles y permisos">
        {canManage && hasAny ? (
          <Button type="button" onClick={openCreate}>
            Nuevo rol
          </Button>
        ) : null}
      </ScreenHeader>

      <div className="mb-4 max-w-md">
        <FieldBox>
          <Label htmlFor="role-search">Buscar por nombre</Label>
          <div className="flex items-center gap-2">
            <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
            <Input
              id="role-search"
              className="min-w-0 flex-1"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
          </div>
        </FieldBox>
      </div>

      <RolesTable
        roles={rolesQuery.data?.items ?? []}
        reference={(_role, index) => pagedReference(rolesQuery.data, index)}
        canManage={canManage}
        isLoading={isSessionLoading || rolesQuery.isPending}
        error={rolesQuery.error ?? null}
        emptyAction={
          canManage && !searching && !hasAny ? (
            <Button type="button" onClick={openCreate}>
              Nuevo rol
            </Button>
          ) : undefined
        }
        onOpen={openRole}
        onDelete={openDelete}
      />

      <div className="mt-4">
        <Pager page={rolesQuery.data} noun={{ one: 'rol', many: 'roles' }} onPageChange={setPage} />
      </div>

      <RoleFormDialog
        open={isFormOpen}
        onOpenChange={setFormOpen}
        role={activeRole}
        readOnly={!canManage}
      />

      <DeleteRoleDialog open={isDeleteOpen} onOpenChange={setDeleteOpen} role={activeRole} />
    </section>
  );
}
