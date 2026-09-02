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

// ============================================================================
// spec 003 — Carwash
// ============================================================================

/** Largo del PIN de pista (RN-18). */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

/**
 * Usuario de pista. NO es un correo: se escribe en una tablet, de pie y a veces
 * con guantes, asi que se restringe a minusculas, digitos, punto y guion.
 */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'El usuario necesita al menos 3 caracteres.' })
  .max(40, { message: 'El usuario no puede pasar de 40 caracteres.' })
  .regex(/^[a-z0-9._-]+$/, {
    message: 'Usá solo letras, números, punto, guion o guion bajo.',
  });

/** PIN de 4 a 8 dígitos. Solo números: el teclado de la tablet es numérico. */
const pin = z
  .string()
  .regex(/^\d+$/, { message: 'El PIN son solo números.' })
  .min(PIN_MIN_LENGTH, { message: `El PIN necesita al menos ${PIN_MIN_LENGTH} dígitos.` })
  .max(PIN_MAX_LENGTH, { message: `El PIN no puede pasar de ${PIN_MAX_LENGTH} dígitos.` });

/** Placa. Se guarda en mayúsculas y sin espacios: una placa = un vehículo (RN-12). */
const plate = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, { message: 'Escribí la placa.' })
  .max(15, { message: 'La placa no puede pasar de 15 caracteres.' })
  .transform((value) => value.replace(/\s+/g, ''));

/**
 * Dinero de entrada. Se acepta cadena o número y se normaliza a cadena decimal
 * de dos decimales, que es como viaja por el contrato: el backend la convierte
 * a centavos enteros y nunca la pasa por un `number`.
 */
const money = z
  .union([z.string().trim(), z.number()])
  .transform((value) => (typeof value === 'number' ? value.toFixed(2) : value))
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'Escribí un monto válido, con hasta dos decimales.',
  })
  .transform((value) => {
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(2, '0')}`;
  });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` });

// --- pista: login ---

export const floorLoginSchema = z.object({
  username,
  // Igual que en el login de oficina: no se valida el largo del PIN, porque un
  // PIN viejo mas corto debe fallar por credenciales, no por formato.
  pin: z.string().min(1, { message: 'Escribí tu PIN.' }),
});

export type FloorLoginInput = z.infer<typeof floorLoginSchema>;

// --- empleados ---

export const createEmployeeSchema = z.object({ fullName, username, pin });
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  fullName: fullName.optional(),
  username: username.optional(),
  /** Reemplazar el PIN invalida las sesiones de pista de ese empleado (RN-18). */
  pin: pin.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// --- clientes ---

export const createCustomerSchema = z.object({
  fullName,
  phone: optionalText(30, 'El teléfono').optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  fullName: fullName.optional(),
  phone: optionalText(30, 'El teléfono').optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/**
 * Consulta de coincidencia antes de crear un cliente (004 RN-1).
 *
 * El nombre es obligatorio y el teléfono no: se pregunta «¿ya existe alguien
 * así?» justo cuando se está por dar de alta a alguien, y para eso siempre hay
 * un nombre escrito. Un teléfono vacío nunca coincide con otro vacío, así que
 * mandarlo o no cambia el resultado pero no la validez.
 */
export const customerMatchQuerySchema = z.object({
  fullName,
  phone: optionalText(30, 'El teléfono').optional(),
});
export type CustomerMatchQuery = z.infer<typeof customerMatchQuerySchema>;

// --- vehiculos ---

export const createVehicleSchema = z.object({
  plate,
  bodyTypeId: z.uuid({ message: 'Elegí el tipo de carro.' }),
  customerId: z.uuid({ message: 'Elegí el cliente.' }),
  make: optionalText(40, 'La marca').optional(),
  color: optionalText(30, 'El color').optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = z.object({
  plate: plate.optional(),
  bodyTypeId: z.uuid({ message: 'Tipo de carro inválido.' }).optional(),
  customerId: z.uuid({ message: 'Cliente inválido.' }).optional(),
  make: optionalText(40, 'La marca').optional(),
  color: optionalText(30, 'El color').optional(),
  isActive: z.boolean().optional(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

// --- catalogo ---

export const createServiceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Escribí el nombre de la categoría.' })
    .max(80, { message: 'El nombre no puede pasar de 80 caracteres.' }),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;

export const updateServiceCategorySchema = createServiceCategorySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;

/** Una celda de la matriz. Que falte NO es cero: es «usar el base» (RN-2). */
const servicePrices = z.array(
  z.object({ bodyTypeId: z.uuid({ message: 'Tipo de carro inválido.' }), price: money }),
);

export const createServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Escribí el nombre del servicio.' })
    .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' }),
  categoryId: z.uuid({ message: 'Elegí la categoría.' }),
  defaultPrice: money,
  prices: servicePrices.default([]),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  categoryId: z.uuid({ message: 'Categoría inválida.' }).optional(),
  defaultPrice: money.optional(),
  /** Si viene, reemplaza la matriz completa. Si no viene, no se toca. */
  prices: servicePrices.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// --- tickets ---

/** Una línea pedida. `unitPrice` ausente = usar el precio de catálogo (RN-2). */
const ticketItem = z.object({
  serviceId: z.uuid({ message: 'Servicio inválido.' }),
  unitPrice: money.optional(),
});

/**
 * Cuerpo de alta de un ticket. Cliente y vehículo se pueden mandar por id (ya
 * existen) o por objeto (se crean al vuelo): en la pista, con el carro
 * esperando, obligar a darlos de alta en otra pantalla primero no es viable.
 */
const ticketBase = {
  customerId: z.uuid().optional(),
  customer: createCustomerSchema.optional(),
  vehicleId: z.uuid().optional(),
  vehicle: z
    .object({
      plate,
      bodyTypeId: z.uuid({ message: 'Elegí el tipo de carro.' }),
      make: optionalText(40, 'La marca').optional(),
      color: optionalText(30, 'El color').optional(),
    })
    .optional(),
  items: z.array(ticketItem),
  notes: optionalText(500, 'La nota').optional(),
};

export const createFloorTicketSchema = z.object(ticketBase);
export type CreateFloorTicketInput = z.infer<typeof createFloorTicketSchema>;

/** Igual que el de pista más el lavador opcional: es el alta de emergencia (RN-7). */
export const createOfficeTicketSchema = z.object({
  ...ticketBase,
  /** Un empleado activo, o nada («Oficina») (RN-8). */
  employeeId: z.uuid({ message: 'Lavador inválido.' }).optional(),
});
export type CreateOfficeTicketInput = z.infer<typeof createOfficeTicketSchema>;

/** Edición de un ticket abierto. `items` reemplaza las líneas completas. */
export const updateTicketSchema = z.object({
  items: z.array(ticketItem).optional(),
  bodyTypeId: z.uuid({ message: 'Tipo de carro inválido.' }).optional(),
  notes: optionalText(500, 'La nota').optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const chargeTicketSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER'], { message: 'Elegí el método de pago.' }),
  amount: money,
});
export type ChargeTicketInput = z.infer<typeof chargeTicketSchema>;
