import type { AuthUser } from '../../domain/auth-user';

/**
 * Puerto de lectura de usuarios para la autenticacion. La implementacion con
 * Prisma vive en `infrastructure/` y se cablea en `auth.module.ts`.
 *
 * Las dos operaciones traen al usuario con sus roles y los permisos de cada
 * rol: los permisos efectivos se resuelven contra la base en cada request, no
 * salen del JWT (RN-6b, con el costo declarado en RN-6c).
 */
export interface AuthUserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  /**
   * Persiste el hash nuevo y la marca que invalida los JWT anteriores (spec
   * 006 RN-3, spec 001 RN-10).
   */
  updatePassword(id: string, passwordHash: string, passwordChangedAt: Date): Promise<void>;
}

/** Token de inyeccion del puerto. */
export const AUTH_USER_REPOSITORY = 'auth:AuthUserRepository';
