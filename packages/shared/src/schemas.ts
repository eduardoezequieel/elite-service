import { z } from 'zod';

import { PAYMENT_METHODS } from './contracts';
import type { PaymentMethod } from './contracts';
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

// --- listas paginadas (spec 065) ---

/** Filas por página cuando el pedido no dice. */
export const DEFAULT_PAGE_SIZE = 50;
/** Tope de filas por página: una tabla de 007 no necesita más. */
export const MAX_PAGE_SIZE = 100;

/**
 * `?page&pageSize` de una lista paginada. Llegan como texto en la URL y salen
 * como número. La respuesta es un `Page<T>` (`contracts.ts`).
 */
export const pageQueryShape = {
  page: z.coerce.number().int().min(1, { message: 'La página empieza en 1.' }).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE, { message: `No más de ${MAX_PAGE_SIZE} filas por página.` })
    .default(DEFAULT_PAGE_SIZE),
};
export const pageQuerySchema = z.object(pageQueryShape);
export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Una bandera en la query. En una URL `'false'` es texto, y el texto es
 * verdadero: por eso se traduce a mano.
 */
export const queryFlagSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

// --- auth ---

export const loginSchema = z.object({
  email,
  // En el login no se valida el largo: una contrasena vieja mas corta debe
  // poder intentarlo y fallar por credenciales, no por formato.
  password: z.string().min(1, { message: 'Escribí tu contraseña.' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Escribí tu contraseña actual.' }),
  newPassword: password,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Credenciales de quien autoriza una accion destructiva desde la pantalla de
 * otro (045). No abre sesion: solo firma esa llamada. Va anidada en el body de
 * la accion, nunca en un endpoint propio.
 *
 * Igual que el login, no valida el largo de la contrasena: la respuesta tiene
 * que salir por credenciales, no por formato.
 */
export const authorizationSchema = z.object({
  email,
  password: z.string().min(1, { message: 'Escribí la contraseña de quien autoriza.' }),
});

export type AuthorizationInput = z.infer<typeof authorizationSchema>;

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

/** Largo del PIN de pista: 6 digitos exactos (044 RN-2). */
export const PIN_LENGTH = 6;

/**
 * Usuario del empleado. Dato de oficina —ficha, tabla, busqueda—, no credencial:
 * a la pista se entra solo con el PIN (044 RN-1). Se restringe a minusculas,
 * digitos, punto y guion porque tambien se escribe en una tablet.
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

/**
 * PIN de pista: {@link PIN_LENGTH} digitos exactos, solo numeros. Es la unica
 * credencial de la pista y es unico entre todos los empleados (044 RN-2, RN-3).
 */
const pin = z.string().regex(new RegExp(`^\\d{${PIN_LENGTH}}$`), {
  message: `El PIN son ${PIN_LENGTH} dígitos, solo números.`,
});

/** Placa. Se guarda en mayúsculas y sin espacios: una placa = un vehículo (RN-12). */
const plate = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, { message: 'Escribí la placa.' })
  .max(15, { message: 'La placa no puede pasar de 15 caracteres.' })
  .transform((value) => value.replace(/\s+/g, ''));

/**
 * La misma regla de placa, para los módulos del contrato con carpeta propia (la
 * flota de renta, spec 095 RN-2): mayúsculas y sin espacios.
 */
export const plateSchema = plate;

/**
 * Tope de cualquier monto del sistema: precios, cobros y arqueos de caja.
 *
 * No es un capricho: la columna es `Decimal(12,2)` y sin tope un campo de
 * veinte dígitos llega hasta Postgres y revienta ahí. Se corta mucho antes, en
 * una cifra que un taller no alcanza en una sola línea ni en un solo conteo.
 */
export const MAX_MONEY = '99999.99';

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
  })
  // Se compara como texto, por largo y después alfabéticamente: las dos
  // cadenas tienen el mismo formato, y un número de veinte dígitos no pasa por
  // `Number` sin perder precisión.
  .refine(
    (value) => {
      const trimmed = value.replace(/^0+(?=\d)/, '');

      return (
        trimmed.length < MAX_MONEY.length ||
        (trimmed.length === MAX_MONEY.length && trimmed <= MAX_MONEY)
      );
    },
    { message: `El monto no puede pasar de $${MAX_MONEY}.` },
  );

/**
 * El mismo schema de dinero, para los módulos del contrato que viven en su
 * propia carpeta (`inventory/`, `sales/`, spec 065). Es el mismo objeto: no hay
 * dos reglas de dinero.
 */
export const moneySchema = money;

/** Tope de una cantidad de inventario. La columna es `Decimal(12, 3)` (065 RN-16). */
export const MAX_QUANTITY = '99999.999';

/**
 * Normaliza una cantidad a cadena de tres decimales, con o sin signo. Igual que
 * el dinero, viaja como cadena y nunca pasa por un `number` en el backend.
 */
const decimalQuantity = (signed: boolean) =>
  z
    .union([z.string().trim(), z.number()])
    .transform((value) => (typeof value === 'number' ? value.toFixed(3) : value))
    .refine((value) => (signed ? /^-?\d+(\.\d{1,3})?$/ : /^\d+(\.\d{1,3})?$/).test(value), {
      message: 'Escribí una cantidad válida, con hasta tres decimales.',
    })
    .transform((value) => {
      const negative = value.startsWith('-');
      const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
      const normalized = `${whole.replace(/^0+(?=\d)/, '')}.${fraction.padEnd(3, '0')}`;

      return negative ? `-${normalized}` : normalized;
    })
    .refine(
      (value) => {
        const absolute = value.replace(/^-/, '');

        return (
          absolute.length < MAX_QUANTITY.length ||
          (absolute.length === MAX_QUANTITY.length && absolute <= MAX_QUANTITY)
        );
      },
      { message: `La cantidad no puede pasar de ${MAX_QUANTITY}.` },
    )
    .refine((value) => !/^-?0\.000$/.test(value), {
      message: 'La cantidad no puede ser cero.',
    });

/**
 * Cantidad de inventario (065 RN-6, RN-16): mayor que cero, hasta tres
 * decimales. Sale normalizada: `2` → `"2.000"`.
 */
export const quantitySchema = decimalQuantity(false);

/** Cantidad con signo y distinta de cero: el ajuste de inventario (065 RN-12). */
export const signedQuantitySchema = decimalQuantity(true);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} no puede pasar de ${max} caracteres.` });

// --- pista: login ---

/**
 * Entrar a la pista es solo PIN (044 RN-1). No se valida el largo, igual que en
 * el login de oficina: un PIN viejo de otro largo tiene que fallar por
 * credenciales, no por formato, para no delatar cuantos digitos se usan.
 */
export const floorLoginSchema = z.object({
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
  customerId: z.uuid({ message: 'Elegí el cliente.' }).optional(),
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
  /** Cuenta como extra en Rendimiento (spec 067). Sin valor, el API usa `true`. */
  isExtra: z.boolean().optional(),
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

/** Una línea de servicio. `unitPrice` ausente = usar el precio de catálogo (RN-2). */
export const serviceTicketItemSchema = z.object({
  serviceId: z.uuid({ message: 'Servicio inválido.' }),
  unitPrice: money.optional(),
});
export type ServiceTicketItemInput = z.infer<typeof serviceTicketItemSchema>;

/**
 * Una línea de producto del inventario (065 RN-4, RN-6). Sale del inventario al
 * guardarse el ticket. `unitPrice` ausente = el precio del artículo; un producto
 * tiene un solo precio, sin matriz por tipo de carro.
 */
export const productTicketItemSchema = z.object({
  inventoryItemId: z.uuid({ message: 'Producto inválido.' }),
  quantity: quantitySchema,
  unitPrice: money.optional(),
});
export type ProductTicketItemInput = z.infer<typeof productTicketItemSchema>;

/**
 * Una línea pedida: un servicio **o** un producto (065). Se distinguen por la
 * clave (`serviceId` / `inventoryItemId`); usá {@link isProductTicketItem}.
 */
const ticketItem = z.union([serviceTicketItemSchema, productTicketItemSchema]);
export const ticketItemSchema = ticketItem;
export type TicketItemInput = z.infer<typeof ticketItemSchema>;

export function isProductTicketItem(item: TicketItemInput): item is ProductTicketItemInput {
  return 'inventoryItemId' in item;
}

export function isServiceTicketItem(item: TicketItemInput): item is ServiceTicketItemInput {
  return 'serviceId' in item;
}

/**
 * Combos pedidos en un lavado (104). El API los expande en una línea por
 * servicio y producto del combo; que el mismo combo no venga dos veces y que
 * valga hoy lo valida el API (`DUPLICATE_COMBO`, `COMBO_NOT_AVAILABLE`).
 */
const ticketCombos = z.array(z.object({ comboId: z.uuid({ message: 'Combo inválido.' }) }));
export const ticketCombosSchema = ticketCombos;
export type TicketComboInput = z.infer<typeof ticketCombosSchema>[number];

/**
 * Cuerpo de alta de un ticket. Cliente y vehículo se pueden mandar por id (ya
 * existen) o por objeto (se crean al vuelo): en la pista, con el carro
 * esperando, obligar a darlos de alta en otra pantalla primero no es viable.
 */
const ticketBase = {
  customerId: z.uuid().optional(),
  customer: createCustomerSchema.optional(),
  vehicleId: z.uuid().nullable().optional(),
  vehicle: z
    .object({
      plate,
      bodyTypeId: z.uuid({ message: 'Elegí el tipo de carro.' }).optional(),
      make: optionalText(40, 'La marca').optional(),
      color: optionalText(30, 'El color').optional(),
    })
    .optional(),
  items: z.array(ticketItem),
  /** Combos que se expanden en líneas propias al guardar (104). */
  combos: ticketCombos.default([]),
  notes: optionalText(500, 'La nota').optional(),
};

/** Un asignado, o ninguno. Pista exige length 1; oficina admite 0 (035). */
const assigneeIds = z
  .array(z.uuid({ message: 'Empleado inválido.' }))
  .max(1, { message: 'Un lavado queda a cargo de una sola persona.' });

export const createFloorTicketSchema = z.object(ticketBase);
export type CreateFloorTicketInput = z.infer<typeof createFloorTicketSchema>;

/** Igual que el de pista más el asignado opcional: alta de emergencia (RN-7, 035). */
export const createOfficeTicketSchema = z.object({
  ...ticketBase,
  /** Un empleado activo, o nada (sin asignar). */
  employeeId: z.uuid({ message: 'Empleado inválido.' }).optional(),
});
export type CreateOfficeTicketInput = z.infer<typeof createOfficeTicketSchema>;

/** Reemplaza al asignado. Pista exige 1; oficina admite 0. Nunca más de uno (035). */
export const putWashersSchema = z.object({
  employeeIds: assigneeIds,
});
export type PutWashersInput = z.infer<typeof putWashersSchema>;

const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha tiene que ser YYYY-MM-DD.' });

/** Día civil `YYYY-MM-DD`, para los filtros por fecha de otros módulos. */
export const civilDateSchema = civilDate;

/**
 * Rango del reporte de comisiones. Sin fechas, el API usa hoy–hoy. La página
 * (spec 102) corta las tablas; los totales y las cifras son del rango entero.
 */
export const commissionsQuerySchema = z.object({
  from: civilDate.optional(),
  to: civilDate.optional(),
  ...pageQueryShape,
});
export type CommissionsQuery = z.infer<typeof commissionsQuerySchema>;

/** Rango de Rendimiento (spec 067). Mismas reglas que el de comisiones. */
export const performanceQuerySchema = commissionsQuerySchema;
export type PerformanceQuery = CommissionsQuery;

/** Edición de un ticket abierto. `items` reemplaza las líneas completas. */
export const updateTicketSchema = z.object({
  items: z.array(ticketItem).optional(),
  /** Si viene, reemplaza los combos del lavado; si no, no se tocan (104 criterio 8). */
  combos: ticketCombos.optional(),
  bodyTypeId: z.uuid({ message: 'Tipo de carro inválido.' }).optional(),
  notes: optionalText(500, 'La nota').optional(),
});
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

/** Solo la nota, en estados operativos. Lo usa el cobro (`carwash.charge`, 041). */
export const updateTicketNotesSchema = z.object({
  notes: optionalText(500, 'La nota'),
});
export type UpdateTicketNotesInput = z.infer<typeof updateTicketNotesSchema>;

/** Los métodos de pago (069 agrega `OTHER`). Mismo orden que en el cobro. */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  message: 'Elegí el método de pago.',
});

/** Tope de la referencia del comprobante de una transferencia (069 RN-4). */
export const PAYMENT_REFERENCE_MAX_LENGTH = 40;
/** Tope del texto libre de un pago «Otro» (069 RN-5). */
export const PAYMENT_DESCRIPTION_MAX_LENGTH = 60;

/**
 * Un método con su monto y los datos que pide según el método (069):
 * `TRANSFER` lleva cuenta y referencia (RN-4), `OTHER` lleva descripción
 * (RN-5), y ningún método lleva los campos de otro (RN-6). Que la cuenta
 * exista y esté activa lo valida el API (`BANK_ACCOUNT_UNAVAILABLE`).
 */
const paymentLineShape = {
  method: paymentMethodSchema,
  amount: money,
  bankAccountId: z.uuid({ message: 'Cuenta bancaria inválida.' }).optional(),
  reference: z
    .string()
    .trim()
    .min(1, { message: 'Escribí la referencia de la transferencia.' })
    .max(PAYMENT_REFERENCE_MAX_LENGTH, {
      message: `La referencia no puede pasar de ${PAYMENT_REFERENCE_MAX_LENGTH} caracteres.`,
    })
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Escribí qué fue el pago.' })
    .max(PAYMENT_DESCRIPTION_MAX_LENGTH, {
      message: `La descripción no puede pasar de ${PAYMENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
    })
    .optional(),
};

interface PaymentLineFields {
  method: PaymentMethod;
  bankAccountId?: string;
  reference?: string;
  description?: string;
}

/** RN-4/5/6 sobre un renglón, con el error en el campo que corresponde. */
function refinePaymentLine(value: PaymentLineFields, ctx: z.RefinementCtx): void {
  const isTransfer = value.method === 'TRANSFER';
  const isOther = value.method === 'OTHER';

  if (isTransfer) {
    if (value.bankAccountId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['bankAccountId'],
        message: 'Elegí la cuenta a la que entró la transferencia.',
      });
    }
    if (value.reference === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Escribí la referencia de la transferencia.',
      });
    }
  } else {
    if (value.bankAccountId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['bankAccountId'],
        message: 'Solo una transferencia lleva cuenta bancaria.',
      });
    }
    if (value.reference !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reference'],
        message: 'Solo una transferencia lleva referencia.',
      });
    }
  }

  if (isOther) {
    if (value.description === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Escribí qué fue el pago.',
      });
    }
  } else if (value.description !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['description'],
      message: 'Solo un pago «Otro» lleva descripción.',
    });
  }
}

export const chargeTicketSchema = z
  .object({
    ...paymentLineShape,
    /** Si viene, se pega al carro (y al ticket si no tenía) antes de cobrar (040). */
    customerId: z.uuid().optional(),
    customer: createCustomerSchema.optional(),
  })
  .superRefine(refinePaymentLine);
export type ChargeTicketInput = z.infer<typeof chargeTicketSchema>;

/**
 * Un renglón del cobro: un método, su monto (059 RN-3) y los datos de la 069
 * según el método. Lo usan la cuenta (`createChargeSchema`) y la venta suelta
 * (`createCounterSaleSchema`): todo cobro pasa por la misma validación (RN-8).
 */
export const chargePaymentSchema = z.object(paymentLineShape).superRefine(refinePaymentLine);
export type ChargePaymentInput = z.infer<typeof chargePaymentSchema>;

/** Tope de renglones de un cobro partido: uno por método (059, 069). */
export const MAX_CHARGE_PAYMENTS = PAYMENT_METHODS.length;

/**
 * Cambiar el precio de una línea de un lavado ya listo (060). El precio lo
 * teclea el cajero, pero lo aplica la firma del administrador: sin
 * `authorization` no hay cambio (RN-1, RN-3).
 */
export const authorizePriceSchema = z.object({
  unitPrice: money,
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Escribí el motivo del cambio.' })
    .max(500, { message: 'El motivo no puede pasar de 500 caracteres.' }),
  authorization: authorizationSchema,
});
export type AuthorizePriceInput = z.infer<typeof authorizePriceSchema>;

/**
 * La firma de un precio por debajo del catálogo tomada en la misma pantalla
 * (060, 065 RN-21): lo de {@link authorizePriceSchema} sin el precio, que ya
 * viaja en cada línea.
 */
export const priceAuthorizationSchema = authorizePriceSchema.omit({ unitPrice: true });
export type PriceAuthorizationInput = z.infer<typeof priceAuthorizationSchema>;

/**
 * Un producto suelto de la cuenta (065 RN-18, 066): un artículo del inventario
 * con su cantidad. `unitPrice` ausente = el precio del artículo; menor, pide la
 * firma de la 060 en `priceAuthorization`.
 */
export const chargeProductInputSchema = z.object({
  inventoryItemId: z.uuid({ message: 'Producto inválido.' }),
  quantity: quantitySchema,
  unitPrice: money.optional(),
});
export type ChargeProductInput = z.infer<typeof chargeProductInputSchema>;

/**
 * Cobrar una cuenta (059, 066). 0..N lavados listos y 0..N productos sueltos
 * —al menos uno de los dos—, uno o varios pagos: el caso normal —un lavado, un
 * pago— viaja por acá igual que el mancomunado o el que suma productos.
 *
 * Los productos se guardan como una venta suelta (065) colgada de la misma
 * cuenta. `customerName` es el nombre libre de esa venta y se ignora si no hay
 * productos.
 *
 * `cashTendered` es lo que entrega el cliente en efectivo, para el vuelto
 * (RN-10). No es un pago: los pagos siguen sumando exactamente el total.
 */
export const createChargeSchema = z
  .object({
    workOrderIds: z
      .array(z.uuid({ message: 'Lavado inválido.' }))
      .max(20, { message: 'No se pueden cobrar más de 20 lavados juntos.' })
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Hay un lavado repetido en la cuenta.',
      }),
    products: z
      .array(chargeProductInputSchema)
      .max(50, { message: 'Una cuenta admite hasta 50 productos.' })
      .refine((items) => new Set(items.map((item) => item.inventoryItemId)).size === items.length, {
        message: 'Hay un producto repetido en la cuenta: subile la cantidad.',
      })
      .optional(),
    customerName: z
      .string()
      .trim()
      .max(120, { message: 'El nombre no puede pasar de 120 caracteres.' })
      .optional(),
    payments: z
      .array(chargePaymentSchema)
      .min(1, { message: 'Falta el pago.' })
      .max(MAX_CHARGE_PAYMENTS, {
        message: `Un cobro admite hasta ${MAX_CHARGE_PAYMENTS} pagos, uno por método.`,
      }),
    cashTendered: money.optional(),
    priceAuthorization: priceAuthorizationSchema.optional(),
  })
  .refine((value) => value.workOrderIds.length > 0 || (value.products?.length ?? 0) > 0, {
    message: 'La cuenta necesita al menos un lavado o un producto.',
    path: ['workOrderIds'],
  });
export type CreateChargeInput = z.infer<typeof createChargeSchema>;

/** Vincular un responsable al carro de un ticket, sin cobrar. */
export const setTicketResponsibleSchema = z
  .object({
    customerId: z.uuid().optional(),
    customer: createCustomerSchema.optional(),
  })
  .refine((value) => value.customerId !== undefined || value.customer !== undefined, {
    message: 'Escribí un nombre o elegí un responsable.',
  });
export type SetTicketResponsibleInput = z.infer<typeof setTicketResponsibleSchema>;

/**
 * Deshacer un cobro y anular un lavado piden las credenciales de quien autoriza
 * (045): el que esta adelante puede no tener el permiso, y el que lo tiene no
 * cede su sesion.
 */
export const reverseTicketSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { message: 'Escribí el motivo del reverso.' })
    .max(500, { message: 'El motivo no puede pasar de 500 caracteres.' }),
  authorization: authorizationSchema,
});
export type ReverseTicketInput = z.infer<typeof reverseTicketSchema>;

export const voidTicketSchema = reverseTicketSchema;
export type VoidTicketInput = ReverseTicketInput;

/** Deshacer una cuenta entera (059 RN-8). Mismo cuerpo que la 045. */
export const voidChargeSchema = reverseTicketSchema;
export type VoidChargeInput = ReverseTicketInput;

/** Destino operativo desde oficina (037). Cobrado y anulado no van acá. */
export const OPERATIONAL_TICKET_STATUSES = ['OPEN', 'WASHING', 'READY'] as const;
export const setTicketStatusSchema = z.object({
  status: z.enum(OPERATIONAL_TICKET_STATUSES, {
    message: 'Elegí En espera, Lavando o Listo.',
  }),
});
export type SetTicketStatusInput = z.infer<typeof setTicketStatusSchema>;

// --- caja (spec 010) ---

export const openCashSchema = z.object({
  /** Efectivo que ya estaba en el cajon. Default 0; no es un cobro (RN-3). */
  openingFloat: money.default('0.00'),
});
export type OpenCashInput = z.infer<typeof openCashSchema>;

export const closeCashSchema = z.object({
  countedCash: money,
  notes: optionalText(500, 'La nota').optional(),
});
export type CloseCashInput = z.infer<typeof closeCashSchema>;

// ============================================================================
// spec 102 — Toda lista del lavado pagina en servidor
//
// Cada `GET` de lista recibe `?page&pageSize` (`pageQueryShape`) y responde un
// `Page<T>`. Los filtros que antes la pantalla aplicaba en memoria viajan acá:
// recortar en cliente una página ya recortada mentiría el total.
//
// `active` es el mismo en todas: `true` solo activos, `false` solo inactivos,
// sin él todos.
// ============================================================================

const listSearch = z.string().trim().max(120).optional();
/** La búsqueda de texto de una lista, para los módulos con carpeta propia (104). */
export const listSearchSchema = listSearch;

/** `GET /employees`: nombre o usuario. */
export const employeesQuerySchema = z.object({
  search: listSearch,
  active: queryFlagSchema.optional(),
  ...pageQueryShape,
});
export type EmployeesQuery = z.infer<typeof employeesQuerySchema>;

/**
 * `GET /users`: nombre o correo, estado y rol. `excludeSelf` saca de la lista a
 * quien pregunta (la pantalla de usuarios no se muestra a sí mismo).
 */
export const usersQuerySchema = z.object({
  search: listSearch,
  active: queryFlagSchema.optional(),
  roleId: z.uuid({ message: 'Rol inválido.' }).optional(),
  excludeSelf: queryFlagSchema.optional(),
  ...pageQueryShape,
});
export type UsersQuery = z.infer<typeof usersQuerySchema>;

/** `GET /roles`: por nombre. */
export const rolesQuerySchema = z.object({
  search: listSearch,
  ...pageQueryShape,
});
export type RolesQuery = z.infer<typeof rolesQuerySchema>;

/** `GET /service-categories`. */
export const serviceCategoriesQuerySchema = z.object({
  active: queryFlagSchema.optional(),
  ...pageQueryShape,
});
export type ServiceCategoriesQuery = z.infer<typeof serviceCategoriesQuerySchema>;

/** `GET /services`: nombre, código o nombre de la categoría. */
export const servicesQuerySchema = z.object({
  search: listSearch,
  categoryId: z.uuid({ message: 'Categoría inválida.' }).optional(),
  active: queryFlagSchema.optional(),
  ...pageQueryShape,
});
export type ServicesQuery = z.infer<typeof servicesQuerySchema>;

/** `GET /customers`: nombre o teléfono. */
export const customersQuerySchema = z.object({
  q: listSearch,
  ...pageQueryShape,
});
export type CustomersQuery = z.infer<typeof customersQuerySchema>;

/** `GET /vehicles`: placa, marca o dueño; con `customerId`, los de ese cliente. */
export const vehiclesQuerySchema = z.object({
  q: listSearch,
  customerId: z.uuid({ message: 'Cliente inválido.' }).optional(),
  ...pageQueryShape,
});
export type VehiclesQuery = z.infer<typeof vehiclesQuerySchema>;

/** Los estados de un lavado, en el orden de su vida. */
export const TICKET_STATUSES = ['OPEN', 'WASHING', 'READY', 'PAID', 'VOID'] as const;

/** Empleado «Sin asignar» en el filtro de lavados. */
export const TICKET_WASHER_NONE = 'none';
/** Pago «Pendiente» (sin cobrar) en el filtro de lavados. */
export const TICKET_PAYMENT_PENDING = 'pending';

/**
 * `GET /carwash/tickets`. `status` es una lista separada por comas
 * (`OPEN,WASHING,READY`); lo que no es un estado se ignora, y una lista vacía
 * es «todos». Sin `customerId` se recorta a `date` (hoy si no viene); con
 * `customerId` es el historial del cliente, sin recorte por día (004).
 *
 * `serviceId` es el id del servicio o, en líneas sin servicio enlazado, su
 * nombre: es el valor que trae `facets.services`.
 */
export const ticketsQuerySchema = z.object({
  status: z
    .string()
    .trim()
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter((part): part is (typeof TICKET_STATUSES)[number] =>
          (TICKET_STATUSES as readonly string[]).includes(part),
        ),
    )
    .optional(),
  date: civilDate.optional(),
  q: listSearch,
  customerId: z.uuid({ message: 'Cliente inválido.' }).optional(),
  bodyTypeId: z.uuid({ message: 'Carrocería inválida.' }).optional(),
  serviceId: z.string().trim().min(1).max(120).optional(),
  washerId: z
    .union([z.literal(TICKET_WASHER_NONE), z.uuid({ message: 'Empleado inválido.' })])
    .optional(),
  payment: z.enum([TICKET_PAYMENT_PENDING, ...PAYMENT_METHODS]).optional(),
  ...pageQueryShape,
});
export type TicketsQuery = z.infer<typeof ticketsQuerySchema>;

/** `GET /carwash/cash/sessions` y los pagos de `GET /carwash/cash/sessions/:id`. */
export const cashSessionsQuerySchema = pageQuerySchema;
export type CashSessionsQuery = PageQuery;
