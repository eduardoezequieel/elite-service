'use client';

import type { ReactNode } from 'react';
import type { RoleDetail } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * La lista del sistema aplicada a roles.
 *
 * La forma la pone `<DataTable>`: la misma lámina, la misma referencia en la
 * primera columna y la misma pila táctil que usuarios, empleados, catálogo y
 * lavados. Acá solo viven las columnas del rol.
 *
 * Un rol con usuarios asignados no se puede eliminar (RN-6). Esa acción no se
 * apaga con opacidad: se anula por su propio verbo con la regla de anulación, y
 * el motivo va al lado, sin raya.
 */

interface RolesTableProps {
  roles: RoleDetail[];
  /** Con `roles.manage` se edita y se elimina; sin él, solo se mira. */
  canManage: boolean;
  isLoading: boolean;
  error: ApiError | null;
  /** El botón que llena la lista cuando está vacía. Solo con `roles.manage`. */
  emptyAction?: ReactNode;
  /** Abre el diálogo del rol: editar con `roles.manage`, ver sin él. */
  onOpen: (role: RoleDetail) => void;
  onDelete: (role: RoleDetail) => void;
}

function usersLabel(count: number): string {
  return count === 1 ? '1 usuario' : `${count} usuarios`;
}

export function RolesTable({
  roles,
  canManage,
  isLoading,
  error,
  emptyAction,
  onOpen,
  onDelete,
}: RolesTableProps) {
  return (
    <DataTable
      rows={roles}
      rowKey={(role) => role.id}
      isLoading={isLoading}
      errorMessage={error?.message ?? null}
      emptyTitle="Todavía no hay roles"
      emptyMessage="Un rol junta los permisos de un puesto —cajero, encargado— y después se le da a cada persona."
      emptyAction={emptyAction}
      columns={[
        {
          key: 'name',
          header: 'Nombre',
          stack: 'title',
          className: 'whitespace-nowrap',
          cell: (role) => <span className="text-text text-body font-semibold">{role.name}</span>,
        },
        {
          key: 'description',
          header: 'Descripción',
          className: 'whitespace-normal text-text-dim',
          headerClassName: 'w-full whitespace-normal',
          cell: (role) => (role.description?.trim() ? role.description : 'Sin descripción.'),
        },
        {
          key: 'users',
          header: 'Usuarios',
          align: 'right',
          className: 'whitespace-nowrap',
          cell: (role) => <span className="font-mono tabular-nums">{role.userCount}</span>,
        },
        {
          key: 'actions',
          header: 'Acciones',
          stack: 'actions',
          className: 'whitespace-nowrap',
          cell: (role) => (
            <RoleActions role={role} canManage={canManage} onOpen={onOpen} onDelete={onDelete} />
          ),
        },
      ]}
    />
  );
}

/**
 * Las acciones de la fila. Siempre visibles y con el alto de control del
 * sistema: nada queda escondido detrás del `hover`, que en la bahía no existe.
 */
function RoleActions({
  role,
  canManage,
  onOpen,
  onDelete,
}: {
  role: RoleDetail;
  canManage: boolean;
  onOpen: (role: RoleDetail) => void;
  onDelete: (role: RoleDetail) => void;
}) {
  const isBlocked = role.userCount > 0;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={() => onOpen(role)}>
        {canManage ? (
          <>
            <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
            Editar
          </>
        ) : (
          <>
            <Eye className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
            Ver permisos
          </>
        )}
        <span className="sr-only"> el rol {role.name}</span>
      </Button>

      {canManage ? (
        isBlocked ? (
          // La acción no se apaga: se anula por su propio nombre y se dice por
          // qué, al lado y sin raya (DESIGN.md → Shapes).
          <span
            className={cn(
              'text-text-faint text-dense',
              'inline-flex min-h-(--touch-min) items-center gap-1.5 px-2 py-1',
            )}
          >
            <span className="is-ruled-out">Eliminar</span>
            <span>lo tienen {usersLabel(role.userCount)}</span>
          </span>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(role)}>
            <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
            Eliminar
            <span className="sr-only"> el rol {role.name}</span>
          </Button>
        )
      ) : null}
    </div>
  );
}
