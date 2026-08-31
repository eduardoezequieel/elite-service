/**
 * Capa `application`: caso de uso puro. No importa NestJS ni ningún ORM.
 * Sus dependencias entran por el constructor como interfaces, de modo que en
 * los tests se inyecta una implementación en memoria (ver el .spec).
 */

/** Puerto: fuente de tiempo del proceso. */
export interface HealthClock {
  now(): Date;
  uptimeSeconds(): number;
}

/** Implementación por defecto basada en el runtime (sin I/O ni red). */
export const systemHealthClock: HealthClock = {
  now: () => new Date(),
  uptimeSeconds: () => Math.floor(process.uptime()),
};

export interface HealthResult {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export class GetHealthUseCase {
  constructor(private readonly clock: HealthClock = systemHealthClock) {}

  execute(): HealthResult {
    return {
      status: 'ok',
      uptimeSeconds: this.clock.uptimeSeconds(),
      timestamp: this.clock.now().toISOString(),
    };
  }
}
