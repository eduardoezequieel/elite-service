import { Module } from '@nestjs/common';

/**
 * Cascarón de la spec 098 (cobros, depósitos, multas y caja de renta). La 095 lo deja registrado en
 * `app.module.ts` para que la spec que lo llena no toque ese archivo.
 */
@Module({})
export class RentalBillingModule {}
