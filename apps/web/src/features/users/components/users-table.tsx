'use client';

import type { ReactNode } from 'react';
import type { PublicUser } from '@elite/shared';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Eye, Pencil } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table';
import { Stamp } from '@/components/ui/stamp';

/**
 * La lista del sistema aplicada a usuarios.
 *
 * Toda la forma —lámina, referencia en la primera columna, línea de estado,
 * colapso táctil— la pone `<DataTable>`. Acá solo se dice qué columnas tiene un
 * usuario y qué se lee en cada una.
 *
 * Como el API de usuarios no devuelve folio, el número de referencia visible es
 * la posición en la lista.
 */

export interface UsersTableProps {
  users: PublicUser[];
  /** Con `users.manage` la fila ofrece editar; sin él, solo ver la ficha. */
  canManage: boolean;
  isLoading: boolean;
  /** Mensaje de un fallo al pedir la lista, o `null`. */
  errorMessage: string | null;
  /** El botón que llena la lista cuando está vacía. Solo con `users.manage`. */
  emptyAction?: ReactNode;
  onSelect: (user: PublicUser) => void;
}

/** Los roles como texto. Sin roles se dice con una palabra, no con un guion. */
function rolesLabel(user: PublicUser): string {
  if (user.roles.length === 0) return 'Ninguno';

  return user.roles.map((role) => role.name).join(' · ');
}

export function UsersTable({
  users,
  canManage,
  isLoading,
  errorMessage,
  emptyAction,
  onSelect,
}: UsersTableProps) {
  return (
    <DataTable
      rows={users}
      rowKey={(user) => user.id}
      isLoading={isLoading}
      errorMessage={errorMessage}
      emptyTitle="Todavía no hay otros usuarios"
      emptyMessage={
        canManage
          ? 'Acá van las personas que entran a la oficina con su correo y su contraseña. Creá la primera con «Nuevo usuario».'
          : 'Acá van las personas que entran a la oficina con su correo y su contraseña.'
      }
      emptyAction={emptyAction}
      columns={[
        {
          key: 'name',
          header: 'Nombre',
          stack: 'title',
          // Lo desactivado se marca en positivo sobre el dato que dejó de valer
          // —el nombre lleva la regla de anulación— y nunca bajando la opacidad
          // de la fila (DESIGN.md → Shapes).
          cell: (user) => (
            <span className={cn('text-body font-semibold', !user.isActive && 'is-ruled-out')}>
              {user.fullName}
            </span>
          ),
        },
        {
          key: 'email',
          header: 'Correo',
          // El correo y los roles se leen enteros aunque el usuario esté
          // desactivado: hacen falta para reactivarlo.
          cell: (user) => <span className="text-text-dim">{user.email}</span>,
        },
        {
          key: 'roles',
          header: 'Roles',
          className: 'whitespace-normal',
          cell: (user) => <span className="text-dense">{rolesLabel(user)}</span>,
        },
        {
          key: 'status',
          header: 'Estado',
          stack: 'aside',
          cell: (user) =>
            user.isActive ? (
              <Stamp tone="green" label="Activo" />
            ) : (
              <Stamp tone="neutral" label="Inactivo" />
            ),
        },
        {
          key: 'actions',
          header: 'Acciones',
          stack: 'actions',
          // Visible siempre: en la bahía no hay puntero y nada puede esconderse
          // detrás del hover. Sin `users.manage` el verbo cambia, no desaparece:
          // la ficha se sigue pudiendo mirar.
          cell: (user) => (
            <Button variant="outline" size="sm" onClick={() => onSelect(user)}>
              {canManage ? (
                <>
                  <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                  Editar
                </>
              ) : (
                <>
                  <Eye className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                  Ver ficha
                </>
              )}
              <span className="sr-only"> a {user.fullName}</span>
            </Button>
          ),
        },
      ]}
    />
  );
}
