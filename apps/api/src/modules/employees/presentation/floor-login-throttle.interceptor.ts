import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { FloorLoginAttempts } from './floor-login-attempts';

/**
 * Aplica el freno de intentos a `/floor/login` (044 RN-6).
 *
 * Es un interceptor y no un guard porque hace falta mirar **las dos puntas**:
 * el guard solo ve la entrada, y aca el contador se mueve con el resultado.
 *
 * El controller queda sin logica, que es la regla: esto no decide si el PIN
 * sirve, solo cuenta cuantas veces no sirvio.
 */
@Injectable()
export class FloorLoginThrottleInterceptor implements NestInterceptor {
  constructor(private readonly attempts: FloorLoginAttempts) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const client = FloorLoginThrottleInterceptor.clientOf(
      context.switchToHttp().getRequest<Request>(),
    );

    this.attempts.assertAllowed(client);

    return next.handle().pipe(
      tap({
        next: () => this.attempts.clear(client),
        error: (error: unknown) => {
          // Solo cuentan los PIN equivocados. Si el API se cayo mientras tanto,
          // el problema es del API y no se le cobra al que estaba entrando.
          if (error instanceof HttpException && error.getStatus() === HttpStatus.UNAUTHORIZED) {
            this.attempts.recordFailure(client);
          }
        },
      }),
    );
  }

  /**
   * A quien se le cuentan los intentos. Detras de Render/Vercel el socket es
   * siempre el del proxy, asi que sin mirar `X-Forwarded-For` un solo empleado
   * distraido dejaria al taller entero sin entrar.
   */
  private static clientOf(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();

    return first !== undefined && first !== '' ? first : (request.ip ?? 'unknown');
  }
}
