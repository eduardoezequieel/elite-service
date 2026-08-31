'use client';

import { useState } from 'react';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { RequirePermission } from '@/features/auth/components/require-permission';
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
      <section className="flex flex-col gap-2">
        <h1 className="text-display">Usuarios</h1>
        <p className="text-body text-muted-foreground">
          No tenés permiso para ver los usuarios del taller.
        </p>
      </section>
    );
  }

  const currentUserId = session?.user?.id;
  const visibleUsers = (users.data ?? []).filter((user) => user.id !== currentUserId);

  return (
    <section className="flex flex-col gap-4">
      {/* Franja de cabecera: el nombre de la pantalla a la izquierda, las
          acciones a la derecha. */}
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-3">
        <h1 className="text-display">Usuarios</h1>
        <RequirePermission permission="users.manage">
          <Button onClick={() => openDialog({ mode: 'create' })}>Nuevo usuario</Button>
        </RequirePermission>
      </header>

      <div className="rounded-lg border border-rule bg-card overflow-hidden">
        <UsersTable
          users={visibleUsers}
          canManage={canManage}
          isLoading={isLoadingPermissions || users.isPending}
          errorMessage={users.error?.message ?? null}
          onSelect={(user) => openDialog({ mode: canManage ? 'edit' : 'view', user })}
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
