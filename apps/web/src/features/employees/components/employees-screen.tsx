'use client';

import { PERMISSIONS, createEmployeeSchema } from '@elite/shared';
import type { PublicEmployee } from '@elite/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Pencil, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DeactivateConfirmDialog } from '@/components/ui/deactivate-confirm-dialog';
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
import { FieldBox } from '@/components/ui/field-box';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Stamp } from '@/components/ui/stamp';
import { Switch } from '@/components/ui/switch';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebouncedValue } from '@/lib/use-debounced-value';
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
  const [term, setTerm] = useState('');
  const search = useDebouncedValue(term.trim().toLowerCase());
  const searching = search !== '';
  const all = employees.data ?? [];
  const rows = useMemo(() => {
    if (search === '') return all;

    return all.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(search) ||
        employee.username.toLowerCase().includes(search),
    );
  }, [all, search]);

  const newEmployeeButton = canManage ? (
    <Button type="button" onClick={() => setCreating(true)}>
      Nuevo empleado
    </Button>
  ) : null;

  return (
    <div>
      <ScreenHeader title="Empleados">
        {canManage && all.length > 0 ? newEmployeeButton : null}
      </ScreenHeader>

      <div className="mb-4 max-w-md">
        <FieldBox>
          <Label htmlFor="employee-search">Buscar por nombre o usuario</Label>
          <div className="flex items-center gap-2">
            <Search className="text-text-faint size-icon shrink-0" strokeWidth={1.5} aria-hidden />
            <Input
              id="employee-search"
              className="min-w-0 flex-1"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
          </div>
        </FieldBox>
      </div>

      <DataTable
        rows={rows}
        rowKey={(employee) => employee.id}
        isLoading={employees.isPending}
        errorMessage={employees.error?.message ?? null}
        emptyTitle={searching ? 'Ningún empleado coincide' : 'Todavía no hay empleados'}
        emptyMessage={
          searching
            ? `No hay nombre ni usuario que coincida con «${search}».`
            : 'Acá van los lavadores que entran a la pista con su usuario y su PIN.'
        }
        emptyAction={!searching && all.length === 0 ? newEmployeeButton : undefined}
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
                <Stamp tone="queue" label="Activo" />
              ) : (
                <Stamp tone="neutral" label="Inactivo" />
              ),
          },
          {
            key: 'actions',
            header: 'Acciones',
            stack: 'actions' as const,
            className: 'whitespace-nowrap',
            cell: (employee: PublicEmployee) => (
              <Button type="button" variant="outline" onClick={() => setEditing(employee)}>
                {canManage ? (
                  <Pencil className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye className="size-3.5 text-text-faint" strokeWidth={1.5} aria-hidden />
                )}
                {canManage ? 'Editar' : 'Ver'}
                <span className="sr-only"> a {employee.fullName}</span>
              </Button>
            ),
          },
        ]}
      />

      <EmployeeDialog
        key={editing?.id ?? 'nuevo'}
        employee={editing}
        readOnly={!canManage}
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

function buildEmployeeFormSchema(isNew: boolean) {
  return z
    .object({
      fullName: createEmployeeSchema.shape.fullName,
      username: createEmployeeSchema.shape.username,
      pin: z.string(),
      isActive: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (!isNew && values.pin === '') return;

      const result = createEmployeeSchema.shape.pin.safeParse(values.pin);
      if (result.success) return;

      ctx.addIssue({
        code: 'custom',
        path: ['pin'],
        message: result.error.issues[0]?.message ?? 'El PIN no es válido.',
      });
    });
}

type EmployeeFormValues = z.input<ReturnType<typeof buildEmployeeFormSchema>>;
type EmployeeFormOutput = z.output<ReturnType<typeof buildEmployeeFormSchema>>;

/**
 * Alta y edición. En la edición el PIN se deja vacío para no tocarlo: se
 * escribe solo cuando de verdad se lo quiere reemplazar, y hacerlo cierra las
 * sesiones de pista de ese empleado (RN-18).
 *
 * Sin `employees.manage` la ficha es texto plano (nombre, usuario, estado),
 * sin PIN y sin controles muertos. DESIGN.md → Inputs.
 */
function EmployeeDialog({
  employee,
  readOnly,
  open,
  onOpenChange,
}: {
  employee: PublicEmployee | null;
  readOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isNew = employee === null;
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const { toast } = useToast();
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const schema = useMemo(() => buildEmployeeFormSchema(isNew), [isNew]);
  const form = useForm<EmployeeFormValues, unknown, EmployeeFormOutput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      fullName: employee?.fullName ?? '',
      username: employee?.username ?? '',
      pin: '',
      isActive: employee?.isActive ?? true,
    },
  });

  function close(next: boolean): void {
    if (!next) {
      form.reset();
      create.reset();
      update.reset();
      setConfirmingDeactivate(false);
    }

    onOpenChange(next);
  }

  const error = create.error ?? update.error;
  const isPending = create.isPending || update.isPending;
  const fullName = form.watch('fullName');
  const username = form.watch('username');
  const pin = form.watch('pin');
  const pinOk = (!isNew && pin === '') || createEmployeeSchema.shape.pin.safeParse(pin).success;
  const complete = fullName.trim() !== '' && username.trim() !== '' && pinOk;

  function persist(values: EmployeeFormOutput): void {
    if (isNew) {
      create.mutate(
        { fullName: values.fullName, username: values.username, pin: values.pin },
        {
          onSuccess: () => {
            toast({ title: 'Empleado creado', description: values.fullName });
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
          fullName: values.fullName,
          username: values.username,
          isActive: values.isActive,
          ...(values.pin === '' ? {} : { pin: values.pin }),
        },
      },
      {
        onSuccess: () => {
          toast({ title: 'Empleado guardado', description: values.fullName });
          close(false);
        },
      },
    );
  }

  const submit = form.handleSubmit((values) => {
    if (employee?.isActive && !values.isActive) {
      setConfirmingDeactivate(true);
      return;
    }

    persist(values);
  });

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isNew ? 'Nuevo empleado' : readOnly ? 'Ver empleado' : 'Editar empleado'}
            </DialogTitle>
            <DialogDescription>
              {readOnly
                ? 'Solo lectura: no tenés permiso para administrar empleados.'
                : 'El empleado entra a la pista con su usuario y su PIN. No tiene roles ni permisos.'}
            </DialogDescription>
          </DialogHeader>

          {readOnly ? (
            <EmployeeDetail employee={employee} />
          ) : (
            <Form {...form}>
              <form
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                onSubmit={submit}
                noValidate
              >
                <DialogBody className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input id="employee-name" autoComplete="off" {...field} />
                          </FormControl>
                        </FieldBox>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox>
                          <FormLabel>Usuario</FormLabel>
                          <FormControl>
                            <Input
                              id="employee-username"
                              className="font-mono"
                              autoCapitalize="none"
                              autoComplete="off"
                              {...field}
                            />
                          </FormControl>
                        </FieldBox>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pin"
                    render={({ field }) => (
                      <FormItem>
                        <FieldBox>
                          <FormLabel>PIN</FormLabel>
                          <FormControl>
                            <Input
                              id="employee-pin"
                              type="password"
                              inputMode="numeric"
                              autoComplete="off"
                              className="font-mono tracking-[0.2em]"
                              {...field}
                            />
                          </FormControl>
                        </FieldBox>
                        <FormDescription>
                          {isNew
                            ? 'De 4 a 8 dígitos.'
                            : 'Dejalo vacío para no cambiarlo. Si lo reemplazás, se cierran sus sesiones abiertas.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isNew ? null : (
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex min-h-(--touch-min) items-center justify-between gap-3">
                            <FormLabel>Activo</FormLabel>
                            <FormControl>
                              <Switch
                                id="employee-active"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {isNew && !complete ? (
                    <p className="text-text-faint text-dense">
                      Falta{' '}
                      {[
                        fullName.trim() === '' ? 'el nombre' : null,
                        username.trim() === '' ? 'el usuario' : null,
                        pin === '' ? 'el PIN' : null,
                      ]
                        .filter((part): part is string => part !== null)
                        .join(', ')}
                      .
                    </p>
                  ) : null}

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
                    {isNew ? 'Crear empleado' : 'Guardar cambios'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <DeactivateConfirmDialog
        open={confirmingDeactivate}
        onOpenChange={setConfirmingDeactivate}
        title={`¿Desactivar a ${employee?.fullName ?? 'este empleado'}?`}
        description="Pierde las sesiones de pista abiertas y no puede entrar."
        loading={update.isPending}
        error={update.error?.message ?? null}
        onConfirm={() => {
          void form.handleSubmit((values) => {
            setConfirmingDeactivate(false);
            persist(values);
          })();
        }}
      />
    </>
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

function EmployeeDetail({ employee }: { employee: PublicEmployee | null }) {
  if (!employee) return null;

  return (
    <>
      <DialogBody>
        <DetailField label="Nombre">{employee.fullName}</DetailField>
        <DetailField label="Usuario">
          <span className="font-mono">{employee.username}</span>
        </DetailField>
        <DetailField label="Estado">
          {employee.isActive ? (
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
