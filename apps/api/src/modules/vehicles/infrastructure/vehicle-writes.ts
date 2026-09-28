import type { Prisma } from '@prisma/client';

import type { NewVehicleData } from '../application/ports/vehicle.repository';
import { planTransfer } from '../domain/ownership';

/**
 * Las escrituras de un vehiculo que corren con el `tx` de quien llama.
 *
 * Las usan el repositorio de vehiculos y el alta del lavado (079), que crea la
 * ficha o le pone dueno en la misma transaccion que el ticket: si cada uno
 * armara las suyas, un dia la ficha que nace en la pista seria distinta de la
 * que nace en la oficina.
 */

/** Las columnas de una ficha nueva, con su primera fila de propiedad si trae dueno. */
export function vehicleCreateData(data: NewVehicleData): Prisma.VehicleUncheckedCreateInput {
  return {
    plate: data.plate,
    bodyTypeId: data.bodyTypeId,
    make: data.make,
    color: data.color,
    ...(data.customerId === undefined
      ? {}
      : { owners: { create: { customerId: data.customerId } } }),
  };
}

/**
 * Pone a `customerId` como dueno actual (RN-12): cierra la fila vigente si era
 * de otro y abre una nueva. Si ya es suyo, no escribe nada.
 */
export async function transferOwnership(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  customerId: string,
): Promise<void> {
  const owners = await tx.vehicleOwner.findMany({ where: { vehicleId } });
  const plan = planTransfer(owners, customerId);

  if (plan.closePrevious) {
    await tx.vehicleOwner.updateMany({
      where: { vehicleId, isCurrent: true },
      data: { isCurrent: false, toDate: new Date() },
    });
  }

  if (plan.openNew) {
    await tx.vehicleOwner.create({ data: { vehicleId, customerId } });
  }
}
