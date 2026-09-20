import { API_ERROR_CODES } from '@elite/shared';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Fallos seguidos que cierran la puerta. */
export const FLOOR_LOGIN_MAX_FAILURES = 5;

/** Cuanto queda cerrada, y cuanto dura la racha de fallos. */
export const FLOOR_LOGIN_LOCK_MS = 60_000;

/**
 * Freno de intentos de `/floor/login` (044 RN-6).
 *
 * Un PIN son seis digitos y es la unica credencial de la pista: sin freno,
 * probar el millon de combinaciones es cuestion de tiempo de maquina. Con el,
 * cinco fallos seguidos dejan a ese cliente esperando un minuto.
 *
 * Vive en memoria del proceso a proposito: hay una sola instancia del API
 * (spec 011) y un contador en la base costaria una escritura por intento
 * fallido. Reiniciar el proceso lo borra, y esta bien: no es un castigo que
 * haya que conservar.
 *
 * No pretende ser infalible. Quien controle la cabecera `X-Forwarded-For` puede
 * presentarse como otro cliente en cada intento; lo que corta es el intento a
 * ciegas desde una sola maquina, no a un atacante decidido con una botnet.
 */
@Injectable()
export class FloorLoginAttempts {
  private readonly failures = new Map<string, { count: number; until: number }>();

  /** Lanza `429` si ese cliente ya gasto sus intentos y sigue en penitencia. */
  assertAllowed(client: string): void {
    const entry = this.failures.get(client);

    if (entry === undefined) return;

    if (Date.now() >= entry.until) {
      this.failures.delete(client);
      return;
    }

    if (entry.count >= FLOOR_LOGIN_MAX_FAILURES) {
      throw new HttpException(
        {
          code: API_ERROR_CODES.TOO_MANY_ATTEMPTS,
          message: 'Demasiados intentos. Esperá un minuto y volvé a probar.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Cada fallo suma y corre la ventana: la racha se mide desde el ultimo. */
  recordFailure(client: string): void {
    const now = Date.now();

    this.prune(now);

    const entry = this.failures.get(client);
    const count = entry === undefined || now >= entry.until ? 1 : entry.count + 1;

    this.failures.set(client, { count, until: now + FLOOR_LOGIN_LOCK_MS });
  }

  /** Un PIN correcto borra la racha: el que se equivoco fue el mismo que entro. */
  clear(client: string): void {
    this.failures.delete(client);
  }

  /**
   * Las entradas vencidas se tiran al escribir. Sin esto, el mapa crece con
   * cada IP que fallo una vez en la vida.
   */
  private prune(now: number): void {
    for (const [client, entry] of this.failures) {
      if (now >= entry.until) this.failures.delete(client);
    }
  }
}
