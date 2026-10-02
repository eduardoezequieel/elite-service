import type { EmployeesQuery, Page } from '@elite/shared';

import type { Employee } from '../../domain/employee';

/**
 * Puerto de persistencia de empleados. En produccion lo implementa Prisma; en
 * los tests, una implementacion en memoria.
 */

/** Datos con los que nace un empleado. El PIN entra ya digerido (044 RN-4). */
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

/** Un lavado a cargo del empleado que todavia no termino (090). */
export interface UnfinishedWash {
  id: string;
  number: string;
  plate: string;
  status: 'OPEN' | 'WASHING';
}

export interface EmployeeRepository {
  /** Todos, por nombre: las opciones de despacho del inventario (070). */
  findAll(): Promise<Employee[]>;
  /**
   * Una pagina, por nombre y despues por id (spec 102). `search` busca en
   * nombre o usuario sin distinguir mayusculas; `active` recorta por estado.
   */
  findPage(filter: EmployeesQuery): Promise<Page<Employee>>;
  findById(id: string): Promise<Employee | null>;
  /**
   * Quien tiene ese PIN. Es la busqueda del login de pista: una sola consulta
   * por indice, gracias a que el digest es determinista (044 RN-1, RN-4).
   */
  findByPinHash(pinHash: string): Promise<Employee | null>;
  /** `exceptId` deja editar un empleado sin chocar contra si mismo. */
  existsByUsername(username: string, exceptId?: string): Promise<boolean>;
  /** Incluye a los desactivados: un PIN dado de baja no se reparte (044 RN-3). */
  existsByPinHash(pinHash: string, exceptId?: string): Promise<boolean>;
  create(data: NewEmployeeData): Promise<Employee>;
  update(id: string, changes: EmployeeChanges): Promise<Employee>;
  /**
   * Los lavados a su cargo en `OPEN` o `WASHING`, del mas viejo al mas nuevo
   * (090). Los `READY` no: ese trabajo ya esta hecho.
   */
  listUnfinishedWashes(employeeId: string): Promise<UnfinishedWash[]>;
}

export const EMPLOYEE_REPOSITORY = Symbol('employees.EmployeeRepository');
