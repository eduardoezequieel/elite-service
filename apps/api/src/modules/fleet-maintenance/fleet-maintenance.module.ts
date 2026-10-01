import { Module } from '@nestjs/common';

/**
 * Cascarón de la spec 099 (mantenimiento y gastos de la flota). La 095 lo deja registrado en
 * `app.module.ts` para que la spec que lo llena no toque ese archivo.
 */
@Module({})
export class FleetMaintenanceModule {}
