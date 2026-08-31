'use client';

import { useEffect, useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createRoleSchema,
  API_ERROR_CODES,
  type CreateRoleInput,
  type RoleDetail,
} from '@elite/shared';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ApiError } from '@/lib/api';
import { usePermissionCatalog } from '../hooks/use-permission-catalog';
import { useCreateRole, useUpdateRole } from '../hooks/use-roles';
import { PermissionMatrix } from './permission-matrix';

/**
 * Diálogo de crear, editar y ver un rol.
 *
 * La validacion sale de `createRoleSchema` de `@elite/shared` —la misma que
 * corre el backend, sin duplicar— y **un rol vacio es valido**: se crea sin
 * permisos y se le asignan despues (RN-6b).
 *
 * Los errores del API viven donde ocurren: el `message` al pie del formulario y
 * los campos marcados desde `details`. No hay toasts en este sistema.
 *
 * Sin `roles.manage` el mismo dialogo se abre en solo lectura: los campos son
 * texto plano y la matriz se lee, no se opera. Nunca un control muerto.
 */

/** Los campos que el API puede marcar desde `details`. */
const FIELD_NAMES = ['name', 'description', 'permissionKeys'] as const;

type RoleField = (typeof FIELD_NAMES)[number];

/** Lo que maneja el formulario antes de que Zod aplique sus valores por defecto. */
type RoleFormValues = z.input<typeof createRoleSchema>;

function isRoleField(value: string): value is RoleField {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/**
 * Traduce el `details` del API a errores de campo.
 *
 * El pipe de validacion del backend lo emite como `{ campo: mensaje }`; aca se
 * descarta cualquier clave que no sea un campo de este formulario.
 */
function fieldErrorsFrom(details: unknown): [RoleField, string][] {
  if (typeof details !== 'object' || details === null) return [];

  return Object.entries(details as Record<string, unknown>).filter(
    (entry): entry is [RoleField, string] => isRoleField(entry[0]) && typeof entry[1] === 'string',
  );
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El rol que se edita o se mira. `null` crea uno nuevo. */
  role: RoleDetail | null;
  /** Sin `roles.manage`: se mira, no se toca. */
  readOnly?: boolean;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  readOnly = false,
}: RoleFormDialogProps) {
  const fieldId = useId();
  const catalog = usePermissionCatalog(open);
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RoleFormValues, unknown, CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: '', description: '', permissionKeys: [] },
  });

  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;

  // Cada apertura arranca del rol que corresponde, y ningun error de la vez
  // anterior sobrevive.
  useEffect(() => {
    if (!open) return;

    resetCreate();
    resetUpdate();
    reset({
      name: role?.name ?? '',
      description: role?.description ?? '',
      permissionKeys: role?.permissionKeys ?? [],
    });
  }, [open, role, reset, resetCreate, resetUpdate]);

  const nameId = `${fieldId}-name`;
  const descriptionId = `${fieldId}-description`;
  const matrixId = `${fieldId}-permissions`;
  const nameErrorId = `${nameId}-error`;
  const descriptionErrorId = `${descriptionId}-error`;
  const permissionsErrorId = `${matrixId}-error`;
  const formErrorId = `${fieldId}-error`;

  const isEditing = role !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const formError: ApiError | null = createMutation.error ?? updateMutation.error ?? null;

  function applyApiError(error: ApiError) {
    for (const [field, message] of fieldErrorsFrom(error.details)) {
      setError(field, { type: 'server', message });
    }

    // Un nombre repetido es un error del campo nombre, aunque llegue como 409.
    if (error.code === API_ERROR_CODES.NAME_TAKEN) {
      setError('name', { type: 'server', message: error.message });
    }
  }

  const onSubmit = handleSubmit((values) => {
    if (role) {
      // `permissionKeys` reemplaza el conjunto completo de permisos del rol.
      updateMutation.mutate(
        { id: role.id, input: values },
        { onSuccess: () => onOpenChange(false), onError: applyApiError },
      );
      return;
    }

    createMutation.mutate(values, {
      onSuccess: () => onOpenChange(false),
      onError: applyApiError,
    });
  });

  const title = readOnly ? 'Permisos del rol' : isEditing ? 'Editar rol' : 'Nuevo rol';
  const description = readOnly
    ? 'Podés ver los permisos de este rol, pero no cambiarlos.'
    : 'Un rol sin permisos también es válido: se crea vacío y se le asignan después.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={nameId}>Nombre</Label>
            {readOnly ? (
              <p id={nameId} className="text-body">
                {role?.name}
              </p>
            ) : (
              <>
                <Input
                  id={nameId}
                  autoComplete="off"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? nameErrorId : undefined}
                  {...register('name')}
                />
                {errors.name ? (
                  <p id={nameErrorId} className="text-label font-normal text-stamp-red">
                    {errors.name.message}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={descriptionId}>Descripción</Label>
            {readOnly ? (
              <p id={descriptionId} className="text-body text-muted-foreground">
                {role?.description?.trim() ? role.description : 'Sin descripción.'}
              </p>
            ) : (
              <>
                <Input
                  id={descriptionId}
                  autoComplete="off"
                  aria-invalid={errors.description ? true : undefined}
                  aria-describedby={errors.description ? descriptionErrorId : undefined}
                  {...register('description')}
                />
                {errors.description ? (
                  <p id={descriptionErrorId} className="text-label font-normal text-stamp-red">
                    {errors.description.message}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="mt-4 flex flex-col gap-0.5">
              <p className="text-title">Permisos</p>
              <p className="text-label font-normal text-muted-foreground">
                Cada fila es un módulo y cada columna una acción. La casilla vive en el cruce.
              </p>
            </div>

            <Controller
              control={control}
              name="permissionKeys"
              render={({ field }) => (
                <PermissionMatrix
                  id={matrixId}
                  groups={catalog.data ?? []}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  readOnly={readOnly}
                  isLoading={catalog.isPending}
                />
              )}
            />

            {catalog.error ? (
              <p className="text-label font-normal text-stamp-red" role="alert">
                {catalog.error.message}
              </p>
            ) : null}

            {errors.permissionKeys ? (
              <p id={permissionsErrorId} className="text-label font-normal text-stamp-red">
                {errors.permissionKeys.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p id={formErrorId} className="text-body text-stamp-red" role="alert">
              {formError.message}
            </p>
          ) : null}

          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </Button>
            {readOnly ? null : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear rol'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
