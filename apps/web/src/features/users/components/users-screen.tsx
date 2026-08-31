'use client';

import { useState } from 'react';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';

import { PageHeader } from '@/components/app-shell/page-header';
import { Button } from '@/components/ui/button';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCreateUser, useUpdateUser, useUsers } from '../hooks/use-users';
import { UserDialog, type UserDialogMode } from './user-dialog';
import { UsersTable } from './users-table';

/**
 * `/settings/users` — la pantalla completa.
 *
 * Los permisos son parte del diseño, no un filtro tardío: la pantalla se ve con
 * `users.read` y las acciones piden `users.manage`. Quien solo lee no ve el
 * botón de crear ni la acción de editar, y abre la ficha como texto plano.
 */

interface DialogState {
  mode: UserDialogMode;
  user?: PublicUser;
}

export function UsersScreen() {
  const { can, isLoading: isLoadingPermissions } = usePermissions();
  const canRead = can('users.read');
  const canManage = can('users.manage');

  const users = useUsers(canRead);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [dialog, setDialog] = useState<DialogState | null>(null);

  function openDialog(next: DialogState) {
    createUser.reset();
    updateUser.reset();
    setDialog(next);
  }

  function handleCreate(input: CreateUserInput) {
    createUser.mutate(input, { onSuccess: () => setDialog(null) });
  }

  function handleUpdate(input: UpdateUserInput) {
    const target = dialog?.user;
    if (!target) return;

    updateUser.mutate({ id: target.id, input }, { onSuccess: () => setDialog(null) });
  }

  if (!isLoadingPermissions && !canRead) {
    return (
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Usuarios"
          description="No tenés permiso para ver los usuarios del taller."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="Usuarios"
        description="Quién entra al sistema y con qué roles. El correo identifica la cuenta y no se cambia."
        actions={
          <RequirePermission permission="users.manage">
            <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
          </RequirePermission>
        }
      />

      <UsersTable
        users={users.data ?? []}
        canManage={canManage}
        isLoading={isLoadingPermissions || users.isPending}
        errorMessage={users.error?.message ?? null}
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
