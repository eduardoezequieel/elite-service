'use client';

import type { PublicUser } from '@elite/shared';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Reference } from '@/components/ui/reference';
import { Stamp } from '@/components/ui/stamp';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * La tabla del sistema aplicada a usuarios.
 *
 * DESIGN.md → Tables: sin cebra, filete de 1px entre filas, sin sombra,
 * cabecera en Label y cifras tabulares. La primera columna es el numero de
 * referencia; como el API de usuarios no devuelve folio, el numero visible es
 * la posicion en la lista.
 *
 * En pantalla angosta las columnas secundarias se retiran, pero su contenido no
 * se pierde: baja apilado bajo el nombre, para que nunca haya una columna
 * escondida fuera de la pantalla.
 */

export interface UsersTableProps {
  users: PublicUser[];
  /** Con `users.manage` la fila ofrece editar; sin el, solo ver la ficha. */
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

export function UsersTable({
  users,
  canManage,
  isLoading,
  errorMessage,
  onSelect,
}: UsersTableProps) {
  // La tabla conserva siempre su cabecera: lo que cambia es la linea de abajo.
  const notice = errorMessage
    ? errorMessage
    : isLoading
      ? 'Cargando usuarios…'
      : users.length === 0
        ? canManage
          ? 'Todavía no hay otros usuarios. Creá el primero con «Nuevo usuario».'
          : 'Todavía no hay otros usuarios registrados.'
        : null;

  const columnCount = canManage ? 6 : 5;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-16">Ref.</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead className="hidden sm:table-cell">Correo</TableHead>
          <TableHead className="hidden md:table-cell">Roles</TableHead>
          <TableHead>Estado</TableHead>
          {canManage ? (
            <TableHead className="text-right">
              <span className="sr-only">Acciones</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {notice ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columnCount}
              className={cn(
                'whitespace-normal text-dense',
                errorMessage ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {notice}
            </TableCell>
          </TableRow>
        ) : (
          users.map((user, index) => (
            // Lo desactivado se marca en positivo sobre el dato que dejo de
            // valer —el nombre lleva la regla de anulacion— y nunca bajando la
            // opacidad de la fila (DESIGN.md → Shapes). El correo y los roles
            // se siguen leyendo enteros: hacen falta para reactivar al usuario.
            <TableRow key={user.id}>
              <TableCell className="align-middle">
                <Reference value={index + 1} />
              </TableCell>
              <TableCell className="whitespace-normal">
                <button
                  type="button"
                  onClick={() => onSelect(user)}
                  className="flex min-h-(--touch-min) w-full flex-col justify-center gap-0.5 rounded-md text-left"
                >
                  <span className={cn('text-body', !user.isActive && 'is-ruled-out')}>
                    {user.fullName}
                  </span>
                  <span className="text-dense text-muted-foreground sm:hidden">{user.email}</span>
                  <span className="text-dense text-muted-foreground md:hidden">
                    {rolesLabel(user)}
                  </span>
                </button>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {user.email}
              </TableCell>
              <TableCell className="hidden whitespace-normal md:table-cell">
                {rolesLabel(user)}
              </TableCell>
              <TableCell>
                {user.isActive ? (
                  <Stamp tone="green" label="Activo" />
                ) : (
                  <Stamp tone="neutral" label="Inactivo" />
                )}
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  {/* Visible siempre: en la bahía no hay puntero y nada puede
                      esconderse detrás del hover. */}
                  <Button variant="ghost" onClick={() => onSelect(user)}>
                    Editar
                    <span className="sr-only"> a {user.fullName}</span>
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
