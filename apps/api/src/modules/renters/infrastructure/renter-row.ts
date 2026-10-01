import type { Renter } from '@elite/shared';
import type { RentalCustomer } from '@prisma/client';

import { dateToCivil } from '../../../common/prisma/date-column';

/**
 * Cómo se lee un cliente de renta de la base (095). Aparte del repositorio
 * porque lo usan también las rentas (096) al traer al arrendatario.
 */
export function toRenter(row: RentalCustomer): Renter {
  return {
    id: row.id,
    fullName: row.fullName,
    documentId: row.documentId,
    licenseNumber: row.licenseNumber,
    licenseExpiresAt: dateToCivil(row.licenseExpiresAt),
    birthDate: dateToCivil(row.birthDate),
    country: row.country,
    mobilePhone: row.mobilePhone,
    phone: row.phone,
    email: row.email,
    address: row.address,
    occupation: row.occupation,
    workplace: row.workplace,
    permanentAddress: row.permanentAddress,
    permanentPhone: row.permanentPhone,
    representative: row.representative,
    isActive: row.isActive,
    isBlocked: row.isBlocked,
    blockReason: row.blockReason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
