/**
 * Formas que viajan por el API de auth, usuarios y roles (spec 001).
 *
 * Son el contrato: el backend las produce y el frontend las consume sin
 * redefinirlas. Las fechas viajan como ISO 8601, porque JSON no tiene fechas.
 */

/** Un rol visto desde un usuario: lo minimo para mostrarlo en una tabla. */
export interface RoleSummary {
  id: string;
  name: string;
}

/**
 * Un usuario tal como sale del API. Nunca incluye `passwordHash`: no se
 * devuelve ni se loguea (RN-7).
 */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: RoleSummary[];
  createdAt: string;
  updatedAt: string;
}

/** Un rol con sus permisos y cuantos usuarios lo tienen asignado. */
export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de `POST /auth/login`. La sesion viaja en cookie httpOnly. */
export interface LoginResponse {
  user: PublicUser;
  /** Union de los permisos de todos sus roles (RN-3). */
  permissions: string[];
}

/**
 * Respuesta de `GET /auth/me`. Los permisos se resuelven contra la base en cada
 * request, no quedan congelados en el JWT (RN-6b).
 */
export interface SessionResponse {
  user: PublicUser;
  roles: RoleSummary[];
  permissions: string[];
}
