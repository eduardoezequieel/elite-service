'use client';

import { useMemo, useState } from 'react';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldBox } from '@/components/ui/field-box';
import { FilterBar, FiltersPopover, useFilterValues } from '@/components/ui/filters-popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  activityFlag,
  activityOptions,
  countActiveFilters,
  isAll,
  withAllOption,
} from '@/lib/list-filters';
import { LIST_PAGE_SIZE } from '@/lib/list-params';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useSession } from '@/features/auth/hooks/use-session';
import { Pager } from '@/features/inventory/components/pager';
import { pagedReference } from '@/features/inventory/format';
import { useListPage } from '@/features/inventory/hooks/use-list-page';
import { useAssignableRoles } from '../hooks/use-assignable-roles';
import { useCreateUser, useUpdateUser, useUsers } from '../hooks/use-users';
import { UserDialog, type UserDialogMode } from './user-dialog';
import { UsersTable } from './users-table';

/**
 * `/settings/users` — la pantalla completa.
 *
 * Los permisos son parte del diseño, no un filtro tardío: la pantalla se ve con
 * `users.read` y las acciones piden `users.manage`. Quien solo lee no ve el
 * botón de crear ni la acción de editar, y abre la ficha como texto plano.
 *
 * El usuario autenticado no se lista a sí mismo en esta tabla: esta pantalla es
 * para administrar a los demás usuarios del taller, no para editar el propio
 * perfil (RN-10 / Fuera de alcance).
 */

interface DialogState {
  mode: UserDialogMode;
  user?: PublicUser;
}

export function UsersScreen({ initialPage = 1 }: { initialPage?: number }) {
  const { data: session } = useSession();
  const { can, isLoading: isLoadingPermissions } = usePermissions();
  const canRead = can('users.read');
  const canManage = can('users.manage');

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const currentUserId = session?.user?.id;
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim());
  const searching = search !== '';
  const extra = useFilterValues(['active', 'role'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  // Búsqueda, estado y rol los resuelve el API (102), que también saca de la
  // lista a quien mira (`excludeSelf`): la página ya viene recortada.
  const [page, setPage] = useListPage(
    initialPage,
    `${search}|${extra.values.active}|${extra.values.role}`,
  );
  const ready = canRead && currentUserId !== undefined;
  const users = useUsers(
    {
      search: searching ? search : undefined,
      active: activityFlag(extra.values.active),
      roleId: isAll(extra.values.role) ? undefined : extra.values.role,
      excludeSelf: true,
      page,
      pageSize: LIST_PAGE_SIZE,
    },
    ready,
  );
  // ¿Hay otros usuarios? Sin filtros: decide si el botón va arriba o en el vacío.
  const others = useUsers({ excludeSelf: true, pageSize: 1 }, ready);
  const hasOthers = (others.data?.total ?? 0) > 0;
  // El filtro de rol ofrece todos los roles del catálogo, no solo los que
  // salen en la página (sin `roles.read` queda solo «Todos los roles»).
  const assignable = useAssignableRoles();
  const roleOptions = useMemo(
    () =>
      withAllOption(
        'Todos los roles',
        assignable.roles.map((role) => ({ value: role.id, label: role.name })),
      ),
    [assignable.roles],
  );

  function openDialog(next: DialogState) {
    createUser.reset();
    updateUser.reset();
    setDialog(next);
  }

  function handleCreate(input: CreateUserInput) {
    createUser.mutate(input, {
      onSuccess: () => {
        toast({ title: 'Usuario creado', description: input.fullName });
        setDialog(null);
      },
    });
  }

  function handleUpdate(input: UpdateUserInput) {
    const target = dialog?.user;
    if (!target) return;

    updateUser.mutate(
      { id: target.id, input },
      {
        onSuccess: () => {
          toast({ title: 'Usuario guardado', description: input.fullName ?? target.fullName });
          setDialog(null);
        },
      },
    );
  }

  if (!isLoadingPermissions && !canRead) {
    return (
      <section>
        <ScreenHeader title="Usuarios" />
        <p className="text-body text-text-dim">
          No tenés permiso para ver los usuarios del taller.
        </p>
      </section>
    );
  }

  return (
    <section>
      <ScreenHeader title="Usuarios">
        {canManage && hasOthers ? (
          <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
        ) : null}
      </ScreenHeader>

      <FilterBar className="mb-4">
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="user-search">Buscar por nombre o correo</Label>
            <div className="flex items-center gap-2">
              <Search
                className="text-text-faint size-icon shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <Input
                id="user-search"
                className="min-w-0 flex-1"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                autoComplete="off"
              />
            </div>
          </FieldBox>
        </div>
        <FiltersPopover
          fields={[
            {
              id: 'active',
              label: 'Estado',
              value: extra.values.active,
              options: activityOptions('Todos los estados', 'Activos', 'Inactivos'),
              onChange: (value) => extra.set('active', value),
            },
            {
              id: 'role',
              label: 'Rol',
              value: extra.values.role,
              options: roleOptions,
              onChange: (value) => extra.set('role', value),
            },
          ]}
          onReset={extra.reset}
        />
      </FilterBar>

      <UsersTable
        users={users.data?.items ?? []}
        reference={(_user, index) => pagedReference(users.data, index)}
        canManage={canManage}
        isLoading={isLoadingPermissions || users.isPending}
        errorMessage={users.error?.message ?? null}
        emptyAction={
          canManage && !narrowing && !hasOthers ? (
            <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
          ) : undefined
        }
        onSelect={(user) => openDialog({ mode: canManage ? 'edit' : 'view', user })}
      />

      <div className="mt-4">
        <Pager
          page={users.data}
          noun={{ one: 'usuario', many: 'usuarios' }}
          onPageChange={setPage}
        />
      </div>

      {dialog ? (
        <UserDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          mode={dialog.mode}
          user={dialog.user}
          isPending={createUser.isPending || updateUser.isPending}
          error={(dialog.mode === 'create' ? createUser.error : updateUser.error) ?? null}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      ) : null}
    </section>
  );
}
