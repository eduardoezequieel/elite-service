'use client';

import { useMemo } from 'react';
import { PencilLine } from 'lucide-react';
import type { PublicUser } from '@elite/shared';

import { DataTable, type DataColumn } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/ui/stamp';

/**
 * La tabla del sistema aplicada a usuarios.
 *
 * Acá no se dibuja ninguna tabla: se declaran columnas y `DataTable` pone la
 * lámina, la referencia, los estados y la forma apilada (spec 003 → RN-1). Si
 * esta pantalla se ve distinta a la de roles, el que está mal es `DataTable`.
 */

export interface UsersTableProps {
  users: PublicUser[];
  /** Con `users.manage` la fila ofrece editar; sin él, solo ver la ficha. */
  canManage: boolean;
  isLoading: boolean;
  /** Mensaje de un fallo al pedir la lista, o `null`. */
  errorMessage: string | null;
  onSelect: (user: PublicUser) => void;
}

/** Los roles como texto. Sin roles se dice con una palabra, no con un guion. */
function rolesLabel(user: PublicUser): string {
  if (user.roles.length === 0) return 'Ninguno';

  return user.roles.map((role) => role.name).join(' · ');
}

function usersLabel(count: number): string {
  return count === 1 ? '1 usuario' : `${count} usuarios`;
}

export function UsersTable({
  users,
  canManage,
  isLoading,
  errorMessage,
  onSelect,
}: UsersTableProps) {
  const columns = useMemo<DataColumn<PublicUser>[]>(() => {
    const base: DataColumn<PublicUser>[] = [
      {
        id: 'fullName',
        header: 'Nombre',
        stack: 'title',
        className: 'whitespace-normal',
        cell: (user) => (
          <button
            type="button"
            onClick={() => onSelect(user)}
            className="text-body flex min-h-(--touch-min) items-center rounded-md text-left underline-offset-4 hover:underline"
          >
            {user.fullName}
            <span className="sr-only"> — abrir la ficha</span>
          </button>
        ),
      },
      {
        id: 'email',
        header: 'Correo',
        className: 'text-muted-foreground',
        cell: (user) => user.email,
      },
      {
        id: 'roles',
        header: 'Roles',
        className: 'whitespace-normal',
        cell: (user) => rolesLabel(user),
      },
      {
        id: 'isActive',
        header: 'Estado',
        stack: 'meta',
        cell: (user) =>
          user.isActive ? (
            <Stamp tone="green" label="Activo" />
          ) : (
            <Stamp tone="neutral" label="Inactivo" />
          ),
      },
    ];

    if (!canManage) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: 'Acciones',
        stack: 'actions',
        align: 'right',
        hiddenHeader: true,
        className: 'w-0',
        // Visible siempre: en la bahía no hay puntero y nada puede esconderse
        // detrás del hover.
        cell: (user) => (
          <Button type="button" variant="ghost" onClick={() => onSelect(user)}>
            <PencilLine strokeWidth={1.5} aria-hidden />
            Editar
            <span className="sr-only"> a {user.fullName}</span>
          </Button>
        ),
      },
    ];
  }, [canManage, onSelect]);

  return (
    <DataTable
      title="Usuarios del taller"
      meta={isLoading || errorMessage ? undefined : usersLabel(users.length)}
      caption="Usuarios registrados, con su correo, sus roles y su estado."
      columns={columns}
      rows={users}
      rowKey={(user) => user.id}
      isLoading={isLoading}
      loadingMessage="Cargando usuarios…"
      errorMessage={errorMessage}
      emptyMessage={
        canManage
          ? 'Todavía no hay usuarios. Creá el primero con «Nuevo usuario».'
          : 'Todavía no hay usuarios. Alguien con permiso para administrarlos puede crear el primero.'
      }
    />
  );
}
