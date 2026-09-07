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
  activityOptions,
  ALL_FILTER,
  countActiveFilters,
  matchesActivity,
  uniqueOptions,
  withAllOption,
} from '@/lib/list-filters';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useSession } from '@/features/auth/hooks/use-session';
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

export function UsersScreen() {
  const { data: session } = useSession();
  const { can, isLoading: isLoadingPermissions } = usePermissions();
  const canRead = can('users.read');
  const canManage = can('users.manage');

  const users = useUsers(canRead);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const currentUserId = session?.user?.id;
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim().toLowerCase());
  const searching = search !== '';
  const extra = useFilterValues(['active', 'role'] as const);
  const extraActive = countActiveFilters(Object.values(extra.values));
  const narrowing = searching || extraActive > 0;
  const allVisible = useMemo(
    () => (users.data ?? []).filter((user) => user.id !== currentUserId),
    [currentUserId, users.data],
  );
  const roleOptions = useMemo(
    () =>
      withAllOption(
        'Todos los roles',
        uniqueOptions(
          allVisible.flatMap((user) => user.roles),
          (role) => role.id,
          (role) => role.name,
        ),
      ),
    [allVisible],
  );
  const visibleUsers = useMemo(() => {
    return allVisible.filter((user) => {
      if (search !== '') {
        const hit =
          user.fullName.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
        if (!hit) return false;
      }
      if (!matchesActivity(user.isActive, extra.values.active)) return false;
      if (extra.values.role !== ALL_FILTER && !user.roles.some((role) => role.id === extra.values.role)) {
        return false;
      }

      return true;
    });
  }, [allVisible, extra.values.active, extra.values.role, search]);

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
        {canManage && allVisible.length > 0 ? (
          <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
        ) : null}
      </ScreenHeader>

      <FilterBar className="mb-4">
        <div className="min-w-0 max-w-md flex-1">
          <FieldBox className="h-full">
            <Label htmlFor="user-search">Buscar por nombre o correo</Label>
            <div className="flex items-center gap-2">
              <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
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
        users={visibleUsers}
        canManage={canManage}
        isLoading={isLoadingPermissions || users.isPending}
        errorMessage={users.error?.message ?? null}
        emptyAction={
          canManage && !narrowing && allVisible.length === 0 ? (
            <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
          ) : undefined
        }
        onSelect={(user) => openDialog({ mode: canManage ? 'edit' : 'view', user })}
      />

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
