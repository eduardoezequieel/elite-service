import { UnprocessableEntityException, type PipeTransform } from '@nestjs/common';
import { API_ERROR_CODES } from '@elite/shared';
import type { ZodType } from 'zod';

/**
 * Valida el cuerpo de un request con un schema Zod de `@elite/shared`.
 *
 * La validacion no se duplica: el mismo schema arma el formulario en el
 * frontend. Cuando falla, el error sale con el formato unico del API
 * (`{ code, message, details }`) y `details` lleva los campos con su mensaje,
 * para que la UI pueda marcarlos uno por uno.
 *
 * @example
 * ```ts
 * @Post()
 * create(@Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput) { ... }
 * ```
 */
export class ZodValidationPipe<TOutput> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodType<TOutput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    const details: Record<string, string> = {};

    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_';

      details[field] ??= issue.message;
    }

    // 422 y no 400: la spec 001 declara 422 para la entrada que no pasa
    // validacion. El 400 queda para request malformado, no para datos malos.
    throw new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'Revisá los datos: hay algo que no está bien.',
      details,
    });
  }
}
