import path from 'node:path';

import { PERMISSION_KEYS, PERMISSIONS } from '@elite/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { BusinessArea, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

/**
 * Seed idempotente.
 *
 * 1. Sincroniza el catalogo de permisos desde `@elite/shared` (RN-2): agrega
 *    las claves nuevas y **borra las que ya no estan en el registro**.
 * 2. Crea el rol `Administrator` y le concede todos los permisos vigentes.
 * 3. Crea el usuario administrador desde el `.env`, y SOLO si la tabla de
 *    usuarios esta vacia (RN-9).
 * 4. Siembra el catalogo de carwash: tipos de carro, categorias y los tres
 *    lavados premium con su matriz de precios (spec 003).
 *
 * Correrlo dos veces no rompe nada ni pisa datos de negocio: no toca usuarios,
 * roles creados a mano ni sus asignaciones, salvo la poda del paso 1.
 *
 * **Por que la poda.** Los permisos efectivos se resuelven contra la base
 * (RN-6b), no contra el registro: `effectivePermissions()` devuelve las claves
 * que la base tenga concedidas, sin filtrarlas. Sin poda, una clave que se
 * renombra o se elimina de `@elite/shared` sobrevive en `permissions`, sigue
 * concedida en `role_permissions` y sigue saliendo en `GET /auth/me` — una
 * clave que el codigo ya no reconoce. Peor: si mas adelante se reusa ese
 * nombre para otra cosa, los roles viejos lo tienen sin que nadie lo haya
 * decidido. El registro es la fuente de verdad (RN-2), asi que sincronizar es
 * en las dos direcciones. `RolePermission` cae por cascada.
 */

loadEnv({ path: path.resolve(__dirname, '../../../.env') });

/** Nombre del rol sembrado. Es un dato, no logica: nada en el codigo lo mira. */
const ADMIN_ROLE_NAME = 'Administrator';

/** Factor de bcrypt (RN-7). */
const BCRYPT_ROUNDS = 12;

const PASSWORD_MIN_LENGTH = 8;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    throw new Error(`Falta la variable ${name}. Revisa el .env de la raiz del monorepo.`);
  }

  return value;
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: requireEnv('DATABASE_URL') });
  const prisma = new PrismaClient({ adapter });

  try {
    // --- 1. Catalogo de permisos ---
    const catalog = Object.values(PERMISSIONS).flatMap((group) =>
      Object.values(group.actions).map((action) => ({
        key: action.key,
        description: action.label,
      })),
    );

    for (const permission of catalog) {
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      });
    }

    // Poda: lo que ya no esta en el registro no puede seguir concedido.
    const removed = await prisma.permission.deleteMany({
      where: { key: { notIn: [...PERMISSION_KEYS] } },
    });

    console.info(
      removed.count > 0
        ? `Permisos sincronizados: ${catalog.length} (se quitaron ${removed.count} fuera del registro)`
        : `Permisos sincronizados: ${catalog.length}`,
    );

    // --- 2. Rol Administrator con todos los permisos ---
    const permissions = await prisma.permission.findMany({ select: { id: true } });

    const adminRole = await prisma.role.upsert({
      where: { name: ADMIN_ROLE_NAME },
      update: {},
      create: {
        name: ADMIN_ROLE_NAME,
        description: 'Acceso total. Creado por el seed inicial.',
      },
    });

    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    console.info(`Rol "${ADMIN_ROLE_NAME}" con ${permissions.length} permisos`);

    // If the env admin's role was renamed in the UI, the English
    // `Administrator` row is no longer theirs. Keep *their* roles current
    // so new keys (carwash.cash, carwash.commissions, …) land without a
    // manual patch.
    const adminEmailForSync = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmailForSync) {
      const envAdmin = await prisma.user.findUnique({
        where: { email: adminEmailForSync },
        include: { roles: true },
      });

      if (envAdmin !== null && envAdmin.roles.length > 0) {
        for (const link of envAdmin.roles) {
          await prisma.rolePermission.createMany({
            data: permissions.map((permission) => ({
              roleId: link.roleId,
              permissionId: permission.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }

    // --- 3. Catalogo de carwash (spec 003) ---
    await seedCarwashCatalog(prisma);

    // --- 4. Usuario administrador, solo si no hay ningun usuario (RN-9) ---
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      console.info(`Ya hay ${existingUsers} usuario(s): no se crea el administrador.`);
      return;
    }

    const adminEmail = requireEnv('ADMIN_EMAIL').trim().toLowerCase();
    const adminPassword = requireEnv('ADMIN_PASSWORD');

    if (adminPassword.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`ADMIN_PASSWORD necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    }

    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Administrador',
        passwordHash: await hash(adminPassword, BCRYPT_ROUNDS),
        roles: { create: { roleId: adminRole.id } },
      },
    });

    console.info(`Usuario administrador creado: ${adminEmail}`);
    console.warn('Cambia esa contrasena desde la administracion apenas entres.');
  } finally {
    await prisma.$disconnect();
  }
}

/** Tipos de carroceria. Son datos: el negocio puede agregar mas sin tocar codigo. */
const BODY_TYPES = [
  { key: 'sedan', name: 'Sedán', sortOrder: 1 },
  { key: 'suv', name: 'Camioneta', sortOrder: 2 },
  { key: 'pickup', name: 'Pick up', sortOrder: 3 },
] as const;

/**
 * Categorias de carwash. Las cuatro ultimas nacen vacias a proposito: existen
 * para que el negocio cargue sus servicios desde la pantalla de catalogo.
 */
const CATEGORIES = [
  { name: 'Lavado premium', sortOrder: 1 },
  { name: 'Limpieza de tapicería', sortOrder: 2 },
  { name: 'Pulido de pintura', sortOrder: 3 },
  { name: 'Pulido de silvines', sortOrder: 4 },
  { name: 'Lavado de chasis', sortOrder: 5 },
] as const;

/**
 * Los tres lavados premium con los precios del Excel del negocio, IVA incluido.
 * `base` es el precio de sedan; la matriz cubre los tres tipos (RN-2, RN-3).
 */
const PREMIUM_SERVICES = [
  {
    code: 'SRV-0001',
    name: 'Lavado + aspirado',
    base: '8.00',
    prices: { sedan: '8.00', suv: '10.00', pickup: '10.00' },
  },
  {
    code: 'SRV-0002',
    name: 'Lavado + aspirado + pasteado a mano',
    base: '10.00',
    prices: { sedan: '10.00', suv: '12.00', pickup: '14.00' },
  },
  {
    code: 'SRV-0003',
    name: 'Lavado + aspirado + pasteado a máquina',
    base: '14.00',
    prices: { sedan: '14.00', suv: '16.00', pickup: '18.00' },
  },
] as const;

/**
 * Catalogo de carwash (spec 003).
 *
 * Idempotente y **no pisa precios editados a mano**: cada fila se crea si falta
 * y se deja como esta si ya existe. Un re-seed despues de que el taller ajusto
 * un precio en pantalla no se lo revierte. Lo unico que se corrige siempre es
 * el nombre visible de los tipos de carro, que es texto y no decision del
 * negocio.
 */
async function seedCarwashCatalog(prisma: PrismaClient): Promise<void> {
  const bodyTypes = new Map<string, string>();

  for (const bodyType of BODY_TYPES) {
    const row = await prisma.vehicleBodyType.upsert({
      where: { key: bodyType.key },
      update: { name: bodyType.name },
      create: bodyType,
    });

    bodyTypes.set(bodyType.key, row.id);
  }

  for (const category of CATEGORIES) {
    await prisma.serviceCategory.upsert({
      where: { area_name: { area: BusinessArea.CARWASH, name: category.name } },
      update: {},
      create: { ...category, area: BusinessArea.CARWASH },
    });
  }

  const premium = await prisma.serviceCategory.findUniqueOrThrow({
    where: { area_name: { area: BusinessArea.CARWASH, name: 'Lavado premium' } },
    select: { id: true },
  });

  for (const service of PREMIUM_SERVICES) {
    const row = await prisma.service.upsert({
      where: { code: service.code },
      // Sin `update`: si el negocio le cambio el nombre o el precio base desde
      // la pantalla de catalogo, el re-seed no se lo deshace.
      update: {},
      create: {
        code: service.code,
        name: service.name,
        categoryId: premium.id,
        area: BusinessArea.CARWASH,
        defaultPrice: service.base,
      },
      select: { id: true },
    });

    for (const [key, price] of Object.entries(service.prices)) {
      const bodyTypeId = bodyTypes.get(key);

      if (bodyTypeId === undefined) continue;

      await prisma.servicePrice.upsert({
        where: { serviceId_bodyTypeId: { serviceId: row.id, bodyTypeId } },
        update: {},
        create: { serviceId: row.id, bodyTypeId, price },
      });
    }
  }

  console.info(
    `Catalogo carwash: ${BODY_TYPES.length} tipos de carro, ${CATEGORIES.length} categorias, ${PREMIUM_SERVICES.length} servicios`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
