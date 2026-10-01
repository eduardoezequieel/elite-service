/**
 * El plan de mantenimiento (099): reglas puras, sin Nest ni Prisma.
 */

/** Ya hay una tarea con ese nombre o esa clave. */
export class MaintenanceTaskTakenError extends Error {
  constructor(readonly taskName: string) {
    super(`A maintenance task named ${taskName} already exists`);
    this.name = 'MaintenanceTaskTakenError';
  }
}

/** El nombre para comparar: sin mayúsculas, tildes ni espacios de más. */
export function comparableTaskName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * La clave de una tarea nueva, armada con su nombre: «Lavado de motor» →
 * `lavado_de_motor`. Las del seed (`oil`, `general`…) ya existen y no se
 * tocan; si la clave choca, se le agrega un número (`_2`, `_3`…).
 */
export function taskKeyFrom(name: string, taken: (key: string) => boolean): string {
  const base =
    comparableTaskName(name)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50) || 'task';

  let key = base;
  for (let suffix = 2; taken(key); suffix += 1) key = `${base}_${suffix}`;

  return key;
}

/** Una tarea mide km, días o los dos; nunca ninguno. */
export function hasInterval(task: {
  intervalKm: number | null;
  intervalDays: number | null;
}): boolean {
  return task.intervalKm !== null || task.intervalDays !== null;
}

/**
 * Reparte el costo de un servicio entre sus tareas (un gasto por log): partes
 * iguales en centavos y el resto, un centavo a cada una de las primeras. La
 * suma de las partes es siempre el total.
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];

  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;

  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}
