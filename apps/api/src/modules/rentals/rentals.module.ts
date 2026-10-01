import { Module } from '@nestjs/common';

/**
 * Cascarón de la spec 096 (rentas, calendario y disponibilidad). La 095 lo deja registrado en
 * `app.module.ts` para que la spec que lo llena no toque ese archivo.
 */
@Module({})
export class RentalsModule {}
