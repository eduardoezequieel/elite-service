import path from 'node:path';

import { PERMISSIONS } from '@elite/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

/**
 * Seed idempotente y no destructivo.
 *
 * 1. Sincroniza el catalogo de permisos desde `@elite/shared` (RN-2).
 * 2. Crea el rol `Administrator` con todos los permisos.
 * 3. Crea el usuario administrador desde el `.env`, y SOLO si la tabla de
 *    usuarios esta vacia (RN-9).
 *
 * Correrlo dos veces no rompe nada ni pisa datos existentes.
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

    console.info(`Permisos sincronizados: ${catalog.length}`);

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
