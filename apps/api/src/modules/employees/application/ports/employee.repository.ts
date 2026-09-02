import type { Employee } from '../../domain/employee';

/**
 * Puerto de persistencia de empleados. En produccion lo implementa Prisma; en
 * los tests, una implementacion en memoria.
 */

/** Datos con los que nace un empleado. El PIN entra ya hasheado (RN-18). */
export interface NewEmployeeData {
  username: string;
  fullName: string;
  pinHash: string;
}

/** Cambios sobre un empleado. Lo que no viene, no se toca. */
export interface EmployeeChanges {
  username?: string;
  fullName?: string;
  pinHash?: string;
  /**
   * Se mueve junto con el PIN: todo JWT de pista emitido antes queda invalido,
   * asi que reemplazarlo cierra las sesiones de ese empleado (RN-18).
   */
  pinChangedAt?: Date;
  isActive?: boolean;
}

export interface EmployeeRepository {
  /** Coleccion completa: sin paginacion en v1 (decenas de filas). */
  findAll(): Promise<Employee[]>;
  findById(id: string): Promise<Employee | null>;
  /** El usuario llega ya normalizado en minusculas por el schema Zod. */
  findByUsername(username: string): Promise<Employee | null>;
  /** `exceptId` deja editar un empleado sin chocar contra si mismo. */
  existsByUsername(username: string, exceptId?: string): Promise<boolean>;
  create(data: NewEmployeeData): Promise<Employee>;
  update(id: string, changes: EmployeeChanges): Promise<Employee>;
}

export const EMPLOYEE_REPOSITORY = Symbol('employees.EmployeeRepository');
