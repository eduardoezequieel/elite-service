/**
 * Capa `domain`: TypeScript puro. No importa NestJS, ni Prisma, ni Zod, ni
 * nada del contrato de transporte. Sólo el modelo y sus reglas.
 */

/**
 * Un rol asignado a un usuario. El nombre viaja porque la tabla lo muestra,
 * pero es un dato: nada en el código decide por él (RN-1).
 */
export interface AssignedRole {
  id: string;
  name: string;
}

/**
 * Un usuario del taller.
 *
 * Deliberadamente NO tiene `passwordHash`: el hash entra por el repositorio y
 * nunca sale de la infraestructura, así que no hay forma de que se filtre en
 * una respuesta ni en un log (RN-7).
 *
 * Tampoco se elimina nunca: se desactiva con `isActive = false` (RN-4).
 */
export interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: AssignedRole[];
  createdAt: Date;
  updatedAt: Date;
}
