'use client';

import { useState } from 'react';
import type { RoleDetail } from '@elite/shared';

import { PageHeader } from '@/components/app-shell/page-header';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Button } from '@/components/ui/button';
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
export function RolesScreen() {
  const { can, isLoading: isSessionLoading } = usePermissions();
  const canRead = can('roles.read');
  const canManage = can('roles.manage');

  const rolesQuery = useRoles(canRead);

  const [activeRole, setActiveRole] = useState<RoleDetail | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

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
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Roles y permisos"
          description="No tenés permiso para ver los roles del sistema."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="Roles y permisos"
        description="Cada rol es un puesto del taller y los permisos que ese puesto necesita."
        actions={
          <RequirePermission permission="roles.manage">
            <Button type="button" onClick={openCreate}>
              Nuevo rol
            </Button>
          </RequirePermission>
        }
      />

      <RolesTable
        roles={rolesQuery.data ?? []}
        canManage={canManage}
        isLoading={isSessionLoading || rolesQuery.isPending}
        error={rolesQuery.error ?? null}
        onOpen={openRole}
        onDelete={openDelete}
      />

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
