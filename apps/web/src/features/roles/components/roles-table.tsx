'use client';

import { useMemo } from 'react';
import { Eye, PencilLine, Trash2 } from 'lucide-react';
import type { RoleDetail } from '@elite/shared';

import { DataTable, type DataColumn } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import type { ApiError } from '@/lib/api';

/**
 * La tabla del sistema aplicada a roles.
 *
 * Mismas piezas que la de usuarios: acá solo se declaran columnas (spec 003 →
 * RN-1).
 *
 * Un rol con usuarios asignados no se puede eliminar (spec 001 → RN-6), pero
 * eso **no se dibuja como un botón muerto**: la acción sigue viva y es el
 * diálogo de confirmación el que explica por qué no se puede y qué hacer
 * primero (spec 003 → RN-2).
 */

interface RolesTableProps {
  roles: RoleDetail[];
  /** Con `roles.manage` se edita y se elimina; sin él, solo se mira. */
  canManage: boolean;
  isLoading: boolean;
  error: ApiError | null;
  /** Abre el diálogo del rol: editar con `roles.manage`, ver sin él. */
  onOpen: (role: RoleDetail) => void;
  onDelete: (role: RoleDetail) => void;
}

function usersLabel(count: number): string {
  return count === 1 ? '1 usuario' : `${count} usuarios`;
}

function rolesLabel(count: number): string {
  return count === 1 ? '1 rol' : `${count} roles`;
}

export function RolesTable({
  roles,
  canManage,
  isLoading,
  error,
  onOpen,
  onDelete,
}: RolesTableProps) {
  const columns = useMemo<DataColumn<RoleDetail>[]>(
    () => [
      {
        id: 'name',
        header: 'Nombre',
        stack: 'title',
        className: 'text-foreground font-medium whitespace-normal',
        cell: (role) => role.name,
      },
      {
        id: 'description',
        header: 'Descripción',
        className: 'text-muted-foreground w-full whitespace-normal',
        cell: (role) => (role.description?.trim() ? role.description : 'Sin descripción.'),
      },
      {
        id: 'userCount',
        header: 'Usuarios',
        stack: 'meta',
        align: 'right',
        className: 'tabular',
        cell: (role) => role.userCount,
        stackCell: (role) => usersLabel(role.userCount),
      },
      {
        id: 'actions',
        header: 'Acciones',
        stack: 'actions',
        align: 'right',
        hiddenHeader: true,
        className: 'w-0',
        // Siempre visibles y con el alto de control del sistema: nada queda
        // escondido detrás del hover, que en la bahía no existe.
        cell: (role) => (
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpen(role)}>
              {canManage ? (
                <PencilLine strokeWidth={1.5} aria-hidden />
              ) : (
                <Eye strokeWidth={1.5} aria-hidden />
              )}
              {canManage ? 'Editar' : 'Ver permisos'}
              <span className="sr-only"> el rol {role.name}</span>
            </Button>

            {canManage ? (
              <Button type="button" variant="destructive" onClick={() => onDelete(role)}>
                <Trash2 strokeWidth={1.5} aria-hidden />
                Eliminar
                <span className="sr-only"> el rol {role.name}</span>
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage, onOpen, onDelete],
  );

  return (
    <DataTable
      title="Roles del sistema"
      meta={isLoading || error ? undefined : rolesLabel(roles.length)}
      caption="Roles del sistema, con su descripción y cuántos usuarios los tienen."
      columns={columns}
      rows={roles}
      rowKey={(role) => role.id}
      isLoading={isLoading}
      loadingMessage="Cargando roles…"
      errorMessage={error?.message ?? null}
      emptyMessage={
        canManage
          ? 'Todavía no hay roles. Creá el primero con «Nuevo rol» para repartir permisos por puesto.'
          : 'Todavía no hay roles. Alguien con permiso para administrarlos puede crear el primero.'
      }
    />
  );
}
