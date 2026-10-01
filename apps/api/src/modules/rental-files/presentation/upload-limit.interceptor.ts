import {
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, type Observable } from 'rxjs';

import { tooLarge } from '../application/rental-file.usecases';

/**
 * Multer corta la subida apenas pasa de 5 MB y Nest lo convierte en un 413 en
 * inglés. Va delante del `FileInterceptor` para traducirlo al mismo
 * `FILE_TOO_LARGE` que da el caso de uso (095 RN-7).
 */
export class UploadLimitInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        throw error instanceof PayloadTooLargeException ? tooLarge() : error;
      }),
    );
  }
}
