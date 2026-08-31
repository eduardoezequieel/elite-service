import { z } from 'zod';

import { isPermissionKey } from './permissions';

/**
 * Schemas Zod compartidos. El backend valida la entrada con estos mismos
 * schemas y el frontend arma los formularios con ellos via `zodResolver`, para
 * que la validacion no se duplique ni se desincronice.
 *
 * Los mensajes van en espanol porque los ve el usuario.
 */

/** Minimo de la contrasena (RN-7). */
export const PASSWORD_MIN_LENGTH = 8;

const email = z
  .email({ message: 'Escribí un correo válido.' })
  .trim()
  .toLowerCase()
  .max(255, { message: 'El correo no puede pasar de 255 caracteres.' });

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(200, { message: 'La contraseña no puede pasar de 200 caracteres.' });

const fullName = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el nombre.' })
  .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' });

const roleIds = z.array(z.uuid({ message: 'Rol inválido.' }));

const permissionKeys = z.array(
  z.string().refine(isPermissionKey, { message: 'Ese permiso no existe en el catálogo.' }),
);

// --- auth ---

export const loginSchema = z.object({
  email,
  // En el login no se valida el largo: una contrasena vieja mas corta debe
  // poder intentarlo y fallar por credenciales, no por formato.
  password: z.string().min(1, { message: 'Escribí tu contraseña.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// --- users ---

export const createUserSchema = z.object({
  email,
  fullName,
  password,
  roleIds: roleIds.default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    fullName: fullName.optional(),
    password: password.optional(),
    roleIds: roleIds.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'No hay nada que actualizar.',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// --- roles ---

const roleName = z
  .string()
  .trim()
  .min(1, { message: 'Escribí el nombre del rol.' })
  .max(60, { message: 'El nombre no puede pasar de 60 caracteres.' });

const roleDescription = z
  .string()
  .trim()
  .max(200, { message: 'La descripción no puede pasar de 200 caracteres.' });

export const createRoleSchema = z.object({
  name: roleName,
  description: roleDescription.optional(),
  // Un rol sin permisos es valido: se crea vacio y se le asignan despues (RN-6b).
  permissionKeys: permissionKeys.default([]),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: roleName.optional(),
    description: roleDescription.optional(),
    permissionKeys: permissionKeys.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'No hay nada que actualizar.',
  });

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
