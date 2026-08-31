'use client';

import { useEffect } from 'react';
import type { RoleDetail } from '@elite/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteRole } from '../hooks/use-roles';

/**
 * Confirmacion de borrado.
 *
 * Es el unico lugar donde el boton destructivo va relleno en Sello Rojo
 * (`destructiveSolid`): en la fila de la tabla nunca (DESIGN.md → Buttons).
 *
 * Si el API rechaza el borrado —`409 ROLE_IN_USE` cuando el rol todavia tiene
 * usuarios (RN-6)—, el mensaje se muestra al pie del dialogo, donde ocurrio.
 */
export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleDetail | null;
}) {
  const deleteMutation = useDeleteRole();
  const resetDelete = deleteMutation.reset;

  useEffect(() => {
    if (open) resetDelete();
  }, [open, resetDelete]);

  if (!role) return null;

  const isBlocked = role.userCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar el rol «{role.name}»</DialogTitle>
          <DialogDescription>
            {isBlocked
              ? `No se puede eliminar: todavía lo ${
                  role.userCount === 1 ? 'tiene 1 usuario' : `tienen ${role.userCount} usuarios`
                }. Movelos a otro rol primero.`
              : 'Se elimina el rol y sus permisos. Esta acción no se puede deshacer.'}
          </DialogDescription>
        </DialogHeader>

        {deleteMutation.error ? (
          <p className="text-body text-stamp-red" role="alert">
            {deleteMutation.error.message}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {isBlocked ? 'Cerrar' : 'Cancelar'}
          </Button>
          {isBlocked ? null : (
            <Button
              type="button"
              variant="destructiveSolid"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteMutation.mutate(role.id, { onSuccess: () => onOpenChange(false) })
              }
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar rol'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
