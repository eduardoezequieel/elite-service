'use client';

import type { RoleDetail } from '@elite/shared';

import { Button } from '@/components/ui/button';
import { Reference } from '@/components/ui/reference';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * La tabla de roles — la tabla del sistema.
 *
 * Sin cebra, filete de 1px entre filas, sin sombra, cabecera en Label y cifras
 * tabulares. La primera columna es el numero de referencia de la fila.
 *
 * Bajo `md` no hay scroll horizontal a ciegas: la tabla colapsa a la pila de
 * laminas numeradas de DESIGN.md, con las mismas columnas apiladas.
 *
 * Un rol con usuarios asignados no se puede eliminar (RN-6). Esa accion no se
 * apaga con opacidad: lleva la trama de bloqueo de 45° y el motivo escrito.
 */

const COLUMN_COUNT = 5;

interface RolesTableProps {
  roles: RoleDetail[];
  /** Con `roles.manage` se edita y se elimina; sin el, solo se mira. */
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

export function RolesTable({
  roles,
  canManage,
  isLoading,
  error,
  onOpen,
  onDelete,
}: RolesTableProps) {
  const placeholder = error
    ? error.message
    : isLoading
      ? 'Cargando roles…'
      : 'Todavía no hay roles. Creá el primero para repartir permisos por puesto.';

  const isEmpty = roles.length === 0;

  return (
    <>
      {/* Escritorio: la tabla del sistema. */}
      <div className="hidden rounded-lg border border-rule bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 pl-plate">Ref.</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-full whitespace-normal">Descripción</TableHead>
              <TableHead className="text-right">Usuarios</TableHead>
              <TableHead className="pr-plate text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className={cn('px-plate', error ? 'text-stamp-red' : 'text-muted-foreground')}
                >
                  {placeholder}
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role, index) => (
                <TableRow key={role.id}>
                  <TableCell className="pl-plate">
                    <Reference value={index + 1} />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{role.name}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {role.description?.trim() ? role.description : 'Sin descripción.'}
                  </TableCell>
                  <TableCell className="text-right tabular">{role.userCount}</TableCell>
                  <TableCell className="pr-plate text-right">
                    <RoleActions
                      role={role}
                      canManage={canManage}
                      onOpen={onOpen}
                      onDelete={onDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Táctil: la pila de láminas numeradas, mismas columnas apiladas. */}
      <div className="flex flex-col gap-3 md:hidden">
        {isEmpty ? (
          <p className={cn('text-body', error ? 'text-stamp-red' : 'text-muted-foreground')}>
            {placeholder}
          </p>
        ) : (
          roles.map((role, index) => (
            <article
              key={role.id}
              className="flex flex-col gap-2 rounded-lg border border-rule bg-card p-plate"
            >
              <div className="flex items-baseline justify-between gap-2">
                <Reference value={index + 1} />
                <span className="text-label font-normal tabular text-muted-foreground">
                  {usersLabel(role.userCount)}
                </span>
              </div>

              <p className="text-body font-medium">{role.name}</p>
              <p className="text-dense text-muted-foreground">
                {role.description?.trim() ? role.description : 'Sin descripción.'}
              </p>

              <RoleActions
                role={role}
                canManage={canManage}
                onOpen={onOpen}
                onDelete={onDelete}
                className="mt-2"
              />
            </article>
          ))
        )}
      </div>
    </>
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
  className,
}: {
  role: RoleDetail;
  canManage: boolean;
  onOpen: (role: RoleDetail) => void;
  onDelete: (role: RoleDetail) => void;
  className?: string;
}) {
  const isBlocked = role.userCount > 0;

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpen(role)}>
          {canManage ? 'Editar' : 'Ver permisos'}
          <span className="sr-only"> el rol {role.name}</span>
        </Button>

        {canManage ? (
          isBlocked ? (
            <span
              role="note"
              className="is-blocked inline-flex h-control items-center rounded-md border border-border px-4 text-body font-medium text-muted-foreground"
            >
              Eliminar
            </span>
          ) : (
            <Button type="button" variant="destructive" onClick={() => onDelete(role)}>
              Eliminar
              <span className="sr-only"> el rol {role.name}</span>
            </Button>
          )
        ) : null}
      </div>

      {canManage && isBlocked ? (
        <p className="text-label font-normal text-muted-foreground">
          Bloqueado: lo tienen {usersLabel(role.userCount)}.
        </p>
      ) : null}
    </div>
  );
}
