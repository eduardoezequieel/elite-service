'use client';

import { PERMISSIONS } from '@elite/shared';
import type { PublicEmployee } from '@elite/shared';
import { useState } from 'react';

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
import { Reference } from '@/components/ui/reference';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display">Empleados</h1>
        {canManage ? (
          <Button type="button" onClick={() => setCreating(true)}>
            Nuevo empleado
          </Button>
        ) : null}
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Ref.</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Estado</TableHead>
            {canManage ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(employees.data ?? []).length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManage ? 5 : 4}
                className={cn(
                  'whitespace-normal text-dense',
                  employees.error === null ? 'text-muted-foreground' : 'text-stamp-red',
                )}
              >
                {employees.error?.message ??
                  (employees.isPending
                    ? 'Cargando…'
                    : 'Todavía no hay empleados. Creá el primero con «Nuevo empleado».')}
              </TableCell>
            </TableRow>
          ) : (
            (employees.data ?? []).map((employee, index) => (
              <TableRow key={employee.id}>
                <TableCell className="align-middle">
                  <Reference value={index + 1} />
                </TableCell>
                <TableCell>
                  <span className={cn('text-body', !employee.isActive && 'is-ruled-out')}>
                    {employee.fullName}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono">
                  {employee.username}
                </TableCell>
                <TableCell>
                  {employee.isActive ? (
                    <Stamp tone="green" label="Activo" />
                  ) : (
                    <Stamp tone="neutral" label="Inactivo" />
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" onClick={() => setEditing(employee)}>
                      Editar
                      <span className="sr-only"> a {employee.fullName}</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (!complete) return;

            if (employee === null) {
              create.mutate(
                { fullName: fullName.trim(), username: username.trim(), pin },
                { onSuccess: () => close(false) },
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
              { onSuccess: () => close(false) },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>{employee === null ? 'Nuevo empleado' : 'Editar empleado'}</DialogTitle>
            <DialogDescription>
              El empleado entra a la pista con su usuario y su PIN. No tiene roles ni permisos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="employee-name">Nombre</Label>
            <Input
              id="employee-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="employee-username">Usuario</Label>
            <Input
              id="employee-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="font-mono"
              autoCapitalize="none"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="employee-pin">PIN</Label>
            <Input
              id="employee-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              autoComplete="off"
            />
            <p className="text-muted-foreground text-dense">
              {employee === null
                ? 'De 4 a 8 dígitos.'
                : 'Dejalo vacío para no cambiarlo. Si lo reemplazás, se cierran sus sesiones abiertas.'}
            </p>
          </div>

          {employee === null ? null : (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="employee-active">Activo</Label>
              <Switch id="employee-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          {error ? (
            <p className="text-stamp-red text-body" role="alert">
              {error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!complete || isPending}>
              {employee === null ? 'Crear empleado' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
