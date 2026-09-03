'use client';

import { PERMISSIONS } from '@elite/shared';
import type { PublicEmployee } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { useCreateEmployee, useEmployees, useUpdateEmployee } from '../hooks/use-employees';

/**
 * Empleados de pista, administrados desde la oficina.
 *
 * Mismo patrón que `/settings/users`: tabla del sistema, sin borrar —se
 * desactivan (RN-13)—, y el inactivo lleva la regla de anulación sobre el
 * nombre con su sello, nunca opacidad.
 *
 * A diferencia de usuarios, acá **sí** aparecen todas las filas: un empleado no
 * es el propio usuario que está mirando, así que no hay nada de qué protegerlo.
 */
export function EmployeesScreen() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.employees.actions.read.key);
  const canManage = can(PERMISSIONS.employees.actions.manage.key);
  const employees = useEmployees(canRead);
  const [editing, setEditing] = useState<PublicEmployee | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <ScreenHeader title="Empleados">
        {canManage ? (
          <Button type="button" onClick={() => setCreating(true)}>
            Nuevo empleado
          </Button>
        ) : null}
      </ScreenHeader>

      <DataTable
        rows={employees.data ?? []}
        rowKey={(employee) => employee.id}
        isLoading={employees.isPending}
        errorMessage={employees.error?.message ?? null}
        emptyTitle="Todavía no hay empleados"
        emptyMessage="Acá van los lavadores que entran a la pista con su usuario y su PIN."
        emptyAction={
          canManage ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Nuevo empleado
            </Button>
          ) : undefined
        }
        columns={[
          {
            key: 'name',
            header: 'Nombre',
            headerClassName: 'w-full',
            stack: 'title',
            cell: (employee) => (
              <span className={cn('text-body font-semibold', !employee.isActive && 'is-ruled-out')}>
                {employee.fullName}
              </span>
            ),
          },
          {
            key: 'username',
            header: 'Usuario',
            className: 'whitespace-nowrap',
            cell: (employee) => (
              <span className="text-text-dim font-mono text-dense">{employee.username}</span>
            ),
          },
          {
            key: 'status',
            header: 'Estado',
            stack: 'aside',
            className: 'whitespace-nowrap',
            cell: (employee) =>
              employee.isActive ? (
                <Stamp tone="green" label="Activo" />
              ) : (
                <Stamp tone="neutral" label="Inactivo" />
              ),
          },
          ...(canManage
            ? [
                {
                  key: 'actions',
                  header: 'Acciones',
                  stack: 'actions' as const,
                  className: 'whitespace-nowrap',
                  cell: (employee: PublicEmployee) => (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(employee)}
                    >
                      <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                      Editar
                      <span className="sr-only"> a {employee.fullName}</span>
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />

      <EmployeeDialog
        employee={editing}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </div>
  );
}

/**
 * Alta y edición. En la edición el PIN se deja vacío para no tocarlo: se
 * escribe solo cuando de verdad se lo quiere reemplazar, y hacerlo cierra las
 * sesiones de pista de ese empleado (RN-18).
 */
function EmployeeDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: PublicEmployee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [touched, setTouched] = useState(false);

  // Los campos se cargan una vez al abrir sobre un empleado y no se vuelven a
  // pisar mientras se escribe.
  if (open && !touched) {
    setTouched(true);
    setFullName(employee?.fullName ?? '');
    setUsername(employee?.username ?? '');
    setPin('');
    setIsActive(employee?.isActive ?? true);
  }

  function close(next: boolean): void {
    if (!next) {
      setTouched(false);
      create.reset();
      update.reset();
    }

    onOpenChange(next);
  }

  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;
  const complete =
    fullName.trim() !== '' && username.trim() !== '' && (employee !== null || pin !== '');

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form
          className="flex flex-1 flex-col min-h-0 overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault();

            if (!complete) return;

            if (employee === null) {
              create.mutate(
                { fullName: fullName.trim(), username: username.trim(), pin },
                {
                  onSuccess: () => {
                    toast({ title: 'Empleado creado', description: fullName.trim() });
                    close(false);
                  },
                },
              );
              return;
            }

            update.mutate(
              {
                id: employee.id,
                input: {
                  fullName: fullName.trim(),
                  username: username.trim(),
                  isActive,
                  ...(pin === '' ? {} : { pin }),
                },
              },
              {
                onSuccess: () => {
                  toast({ title: 'Empleado guardado', description: fullName.trim() });
                  close(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{employee === null ? 'Nuevo empleado' : 'Editar empleado'}</DialogTitle>
            <DialogDescription>
              El empleado entra a la pista con su usuario y su PIN. No tiene roles ni permisos.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <FieldBox>
              <Label htmlFor="employee-name">Nombre</Label>
              <Input
                id="employee-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </FieldBox>

            <FieldBox>
              <Label htmlFor="employee-username">Usuario</Label>
              <Input
                id="employee-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="font-mono"
                autoCapitalize="none"
              />
            </FieldBox>

            <div className="grid gap-1.5">
              <FieldBox>
                <Label htmlFor="employee-pin">PIN</Label>
                <Input
                  id="employee-pin"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  autoComplete="off"
                  className="font-mono tracking-[0.2em]"
                />
              </FieldBox>
              <p className="text-text-faint text-dense">
                {employee === null
                  ? 'De 4 a 8 dígitos.'
                  : 'Dejalo vacío para no cambiarlo. Si lo reemplazás, se cierran sus sesiones abiertas.'}
              </p>
            </div>

            {employee === null ? null : (
              <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                <Label htmlFor="employee-active">Activo</Label>
                <Switch id="employee-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}

            {error ? (
              <p className="text-danger-text text-body" role="alert">
                {error.message}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete} loading={isPending}>
              {employee === null ? 'Crear empleado' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
