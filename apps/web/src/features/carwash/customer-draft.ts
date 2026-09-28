import type { Customer } from '@elite/shared';

import { formatPhone } from '@/lib/phone';

/**
 * El cliente de una ficha de lavado mientras se escribe (028, 030), sin React.
 *
 * Un cliente ya registrado lleva `customerId` y una copia `original` de sus
 * datos: si se editan, el perfil se actualiza al guardar el lavado (028).
 */
export interface CustomerDraft {
  customerId?: string;
  fullName: string;
  phone: string;
  original?: {
    fullName: string;
    phone: string;
  };
}

/** Estado inicial del cliente en el formulario. */
export const EMPTY_CUSTOMER: CustomerDraft = {
  customerId: undefined,
  fullName: '',
  phone: '',
  original: undefined,
};

/** Un lavado no se abre sin nombre de cliente. */
export function customerIsComplete(draft: CustomerDraft): boolean {
  return draft.fullName.trim() !== '';
}

/** El nombre del cliente para el resumen. */
export function customerNameOf(draft: CustomerDraft): string {
  return draft.fullName.trim();
}

/** El borrador de un cliente que ya existe, con su copia original (028). */
export function draftFromCustomer(customer: Customer): CustomerDraft {
  const phone = customer.phone ? formatPhone(customer.phone) : '';

  return {
    customerId: customer.id,
    fullName: customer.fullName,
    phone,
    original: { fullName: customer.fullName, phone },
  };
}
