import path from 'node:path';

import { PERMISSION_KEYS, PERMISSIONS } from '@elite/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
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

    // --- 3. Usuario administrador, solo si no hay ningun usuario (RN-9) ---
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
