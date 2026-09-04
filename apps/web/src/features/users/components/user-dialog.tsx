'use client';

import type { ReactNode } from 'react';
import type { CreateUserInput, PublicUser, UpdateUserInput } from '@elite/shared';

import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Stamp } from '@/components/ui/stamp';
import { UserForm } from './user-form';

/**
 * `create` y `edit` piden `users.manage`; `view` es lo que ve quien solo tiene
 * `users.read`: los mismos datos como texto plano, sin caja. DESIGN.md →
 * Inputs: un usuario sin permiso de escritura no ve un control muerto.
 */
export type UserDialogMode = 'create' | 'edit' | 'view';

export interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: UserDialogMode;
  /** El usuario mostrado o editado. Ausente en el alta. */
  user?: PublicUser;
  isPending: boolean;
  error: ApiError | null;
  onCreate: (input: CreateUserInput) => void;
  onUpdate: (input: UpdateUserInput) => void;
}

const TITLES: Record<UserDialogMode, string> = {
  create: 'Nuevo usuario',
  edit: 'Editar usuario',
  view: 'Detalle del usuario',
};

const DESCRIPTIONS: Record<UserDialogMode, string> = {
  create: 'Registrá a alguien del taller y dale los roles que necesita.',
  edit: 'Cambiá los datos, los roles o el acceso de esta persona.',
  view: 'Solo lectura: no tenés permiso para administrar usuarios.',
};

export function UserDialog({
  open,
  onOpenChange,
  mode,
  user,
  isPending,
  error,
  onCreate,
  onUpdate,
}: UserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[mode]}</DialogDescription>
        </DialogHeader>

        {mode === 'view' ? (
          <UserDetail user={user} />
        ) : (
          <UserForm
            // Remontar el formulario al cambiar de usuario: cada ficha arranca
            // con sus propios valores y sin errores heredados.
            key={`${mode}-${user?.id ?? 'nuevo'}`}
            mode={mode}
            user={user}
            isPending={isPending}
            error={error}
            onCreate={onCreate}
            onUpdate={onUpdate}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Un dato de la ficha: etiqueta encima, valor debajo, sin caja. */
function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-label text-text-faint">{label}</span>
      <div className="text-body">{children}</div>
    </div>
  );
}

function UserDetail({ user }: { user?: PublicUser }) {
  if (!user) return null;

  const roles = user.roles.map((role) => role.name).join(' · ');

  return (
    <>
      <DialogBody>
        <DetailField label="Nombre">{user.fullName}</DetailField>
        <DetailField label="Correo">{user.email}</DetailField>
        <DetailField label="Roles">
          {roles === '' ? <span className="text-text-dim">Ninguno</span> : roles}
        </DetailField>
        <DetailField label="Estado">
          {user.isActive ? (
            <Stamp tone="queue" label="Activo" />
          ) : (
            <Stamp tone="neutral" label="Inactivo" />
          )}
        </DetailField>
      </DialogBody>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cerrar
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
