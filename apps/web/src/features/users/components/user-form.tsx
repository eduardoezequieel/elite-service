'use client';

import { useEffect, useMemo } from 'react';
import { useForm, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  API_ERROR_CODES,
  createUserSchema,
  type CreateUserInput,
  type PublicUser,
  type UpdateUserInput,
} from '@elite/shared';

import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { useAssignableRoles } from '../hooks/use-assignable-roles';

/**
 * Formulario de alta y edicion de usuarios.
 *
 * La validacion no se duplica: los campos salen de `createUserSchema` de
 * `@elite/shared`, el mismo schema con el que el API valida la entrada. Lo
 * unico que el formulario agrega es la regla de la contrasena en edicion —
 * vacia significa "no la cambies"— y esa regla tambien delega en el schema
 * compartido para decidir si lo que se escribio es valido.
 */

const passwordSchema = createUserSchema.shape.password;

/**
 * En edicion la contrasena es opcional: vacia no se manda. Cuando trae algo se
 * valida con la regla compartida, para que el mensaje sea el mismo que daria el
 * backend.
 */
const optionalPasswordSchema = z.string().superRefine((value, ctx) => {
  if (value === '') return;

  const result = passwordSchema.safeParse(value);
  if (result.success) return;

  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', message: issue.message });
  }
});

function buildUserFormSchema(mode: UserFormMode) {
  return z.object({
    fullName: createUserSchema.shape.fullName,
    email: createUserSchema.shape.email,
    password: mode === 'create' ? passwordSchema : optionalPasswordSchema,
    roleIds: createUserSchema.shape.roleIds.unwrap(),
    isActive: z.boolean(),
  });
}

export type UserFormMode = 'create' | 'edit';

interface UserFormValues {
  fullName: string;
  email: string;
  password: string;
  roleIds: string[];
  isActive: boolean;
}

/** Los campos que el API puede marcar desde `details`. */
const FORM_FIELDS = ['fullName', 'email', 'password', 'roleIds'] as const;

type UserFormField = (typeof FORM_FIELDS)[number];

function isUserFormField(key: string): key is UserFormField {
  return (FORM_FIELDS as readonly string[]).includes(key);
}

/**
 * Baja un error del API al campo donde ocurrio.
 *
 * DESIGN.md → Inputs: el `message` va al pie del formulario y los campos se
 * marcan desde `details`. No hay toasts en este sistema.
 */
function applyApiError(error: ApiError, setError: UseFormSetError<UserFormValues>): void {
  if (error.code === API_ERROR_CODES.EMAIL_TAKEN) {
    setError('email', { message: error.message });
    return;
  }

  if (error.code === API_ERROR_CODES.INVALID_ROLE) {
    setError('roleIds', {
      message: 'Alguno de los roles elegidos ya no existe. Volvé a elegirlos.',
    });
    return;
  }

  if (error.code !== API_ERROR_CODES.VALIDATION_ERROR) return;

  const details = error.details;
  if (typeof details !== 'object' || details === null) return;

  for (const [field, message] of Object.entries(details as Record<string, unknown>)) {
    if (isUserFormField(field) && typeof message === 'string') {
      setError(field, { message });
    }
  }
}

export interface UserFormProps {
  mode: UserFormMode;
  /** El usuario que se edita. Ausente en el alta. */
  user?: PublicUser;
  /** El envio esta en curso: el boton se bloquea. */
  isPending: boolean;
  /** El error del ultimo envio, o `null`. */
  error: ApiError | null;
  onCreate: (input: CreateUserInput) => void;
  onUpdate: (input: UpdateUserInput) => void;
}

export function UserForm({ mode, user, isPending, error, onCreate, onUpdate }: UserFormProps) {
  const assignableRoles = useAssignableRoles();
  const schema = useMemo(() => buildUserFormSchema(mode), [mode]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      password: '',
      roleIds: user?.roles.map((role) => role.id) ?? [],
      isActive: user?.isActive ?? true,
    },
  });

  // Cada error del API se baja al campo donde ocurrio, apenas llega.
  const { setError } = form;
  useEffect(() => {
    if (error) {
      applyApiError(error, setError);
    }
  }, [error, setError]);

  const submit = form.handleSubmit((values) => {
    if (mode === 'create') {
      onCreate({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        roleIds: values.roleIds,
      });
      return;
    }

    onUpdate({
      fullName: values.fullName,
      roleIds: values.roleIds,
      isActive: values.isActive,
      ...(values.password === '' ? {} : { password: values.password }),
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Nombre y apellido" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'create' ? (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="persona@taller.sv"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="grid gap-1.5">
            <span className="text-label text-muted-foreground">Correo</span>
            <p className="text-body">{user?.email}</p>
            <p className="text-dense text-muted-foreground">
              El correo identifica la cuenta y no se cambia desde acá.
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>
                {mode === 'create'
                  ? 'Al menos 8 caracteres. Se la entregás a la persona en mano.'
                  : 'Dejala vacía para no cambiarla. Cambiarla cierra las sesiones abiertas de esa persona.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="roleIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Roles</FormLabel>
              {assignableRoles.isForbidden ? (
                <p className="text-dense text-muted-foreground">
                  No podés ver el catálogo de roles, así que acá no se asignan. Necesitás el permiso
                  «roles.read» para elegirlos.
                </p>
              ) : assignableRoles.isLoading ? (
                <p className="text-dense text-muted-foreground">Cargando roles…</p>
              ) : assignableRoles.error ? (
                <p className="text-dense text-destructive">{assignableRoles.error.message}</p>
              ) : assignableRoles.roles.length === 0 ? (
                <p className="text-dense text-muted-foreground">
                  Todavía no hay roles creados. Sin rol, la persona entra sin ningún permiso.
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto rounded-md border border-input bg-card p-1">
                  {assignableRoles.roles.map((role) => {
                    const checkboxId = `role-${role.id}`;
                    const checked = field.value.includes(role.id);

                    return (
                      <div
                        key={role.id}
                        className="flex min-h-(--touch-min) items-center gap-3 px-2"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(value) => {
                            field.onChange(
                              value === true
                                ? [...field.value, role.id]
                                : field.value.filter((id) => id !== role.id),
                            );
                          }}
                        />
                        <Label htmlFor={checkboxId} className="flex-1 text-body text-foreground">
                          {role.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'edit' ? (
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem>
                <div className="flex min-h-(--touch-min) items-center justify-between gap-4">
                  <FormLabel>Usuario activo</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
                <FormDescription>
                  Un usuario inactivo no puede iniciar sesión y sus sesiones abiertas dejan de
                  valer.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {error ? <p className="text-dense text-destructive">{error.message}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
