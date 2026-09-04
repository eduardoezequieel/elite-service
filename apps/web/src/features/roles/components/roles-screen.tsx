'use client';

import { useMemo, useState } from 'react';
import type { RoleDetail } from '@elite/shared';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
export function RolesScreen() {
  const { can, isLoading: isSessionLoading } = usePermissions();
  const canRead = can('roles.read');
  const canManage = can('roles.manage');

  const rolesQuery = useRoles(canRead);

  const [activeRole, setActiveRole] = useState<RoleDetail | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim().toLowerCase());
  const searching = search !== '';
  const allRoles = rolesQuery.data ?? [];
  const roles = useMemo(() => {
    if (search === '') return allRoles;

    return allRoles.filter((role) => role.name.toLowerCase().includes(search));
  }, [allRoles, search]);

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
        {canManage && allRoles.length > 0 ? (
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
        roles={roles}
        canManage={canManage}
        isLoading={isSessionLoading || rolesQuery.isPending}
        error={rolesQuery.error ?? null}
        emptyAction={
          canManage && !searching && allRoles.length === 0 ? (
            <Button type="button" onClick={openCreate}>
              Nuevo rol
            </Button>
          ) : undefined
        }
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
