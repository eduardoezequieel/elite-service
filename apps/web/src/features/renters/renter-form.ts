import { createRenterSchema, updateRenterSchema } from '@elite/shared';
import type { Renter } from '@elite/shared';
import { z } from 'zod';

import {
  TYPED_DATE_MESSAGE,
  civilOrNull,
  civilToField,
  isTypedDateValid,
  textOrNull,
} from '../rentals/form-draft';

/**
 * El formulario de un cliente de renta (095). Los nombres de campo son los del
 * contrato: un error del schema cae solo en su campo.
 */
export interface RenterFormValues {
  fullName: string;
  documentId: string;
  licenseNumber: string;
  licenseExpiresAt: string;
  birthDate: string;
  country: string;
  mobilePhone: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  workplace: string;
  permanentAddress: string;
  permanentPhone: string;
  representative: string;
  isActive: boolean;
  isBlocked: boolean;
  blockReason: string;
  notes: string;
}

export const EMPTY_RENTER_FORM: RenterFormValues = {
  fullName: '',
  documentId: '',
  licenseNumber: '',
  licenseExpiresAt: '',
  birthDate: '',
  country: 'El Salvador',
  mobilePhone: '',
  phone: '',
  email: '',
  address: '',
  occupation: '',
  workplace: '',
  permanentAddress: '',
  permanentPhone: '',
  representative: '',
  isActive: true,
  isBlocked: false,
  blockReason: '',
  notes: '',
};

const TEXT_FIELDS = [
  'documentId',
  'licenseNumber',
  'country',
  'mobilePhone',
  'phone',
  'email',
  'address',
  'occupation',
  'workplace',
  'permanentAddress',
  'permanentPhone',
  'representative',
  'notes',
] as const;

const DATE_FIELDS = ['licenseExpiresAt', 'birthDate'] as const;

export function renterFormValuesOf(renter: Renter): RenterFormValues {
  return {
    fullName: renter.fullName,
    documentId: renter.documentId ?? '',
    licenseNumber: renter.licenseNumber ?? '',
    licenseExpiresAt: civilToField(renter.licenseExpiresAt),
    birthDate: civilToField(renter.birthDate),
    country: renter.country ?? '',
    mobilePhone: renter.mobilePhone ?? '',
    phone: renter.phone ?? '',
    email: renter.email ?? '',
    address: renter.address ?? '',
    occupation: renter.occupation ?? '',
    workplace: renter.workplace ?? '',
    permanentAddress: renter.permanentAddress ?? '',
    permanentPhone: renter.permanentPhone ?? '',
    representative: renter.representative ?? '',
    isActive: renter.isActive,
    isBlocked: renter.isBlocked,
    blockReason: renter.blockReason ?? '',
    notes: renter.notes ?? '',
  };
}

/** El cuerpo del pedido. Sin bloqueo no viaja motivo. */
export function renterDraft(values: RenterFormValues): Record<string, unknown> {
  const draft: Record<string, unknown> = {
    fullName: values.fullName,
    isActive: values.isActive,
    isBlocked: values.isBlocked,
    blockReason: values.isBlocked ? textOrNull(values.blockReason) : null,
  };

  for (const field of TEXT_FIELDS) draft[field] = textOrNull(values[field]);
  for (const field of DATE_FIELDS) draft[field] = civilOrNull(values[field]);

  return draft;
}

const formShape = z.custom<RenterFormValues>().superRefine((values, ctx) => {
  for (const field of DATE_FIELDS) {
    if (!isTypedDateValid(values[field])) {
      ctx.addIssue({ code: 'custom', path: [field], message: TYPED_DATE_MESSAGE });
    }
  }
  if (values.isBlocked && values.blockReason.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['blockReason'],
      message: 'Escribí por qué no se le renta.',
    });
  }
});

/** Documento y celular son obligatorios en el alta de la web, no en el API (108). */
function requireIdentity(values: RenterFormValues, ctx: z.RefinementCtx) {
  if (values.documentId.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['documentId'],
      message: 'Escribí el DUI o el pasaporte.',
    });
  }
  if (values.mobilePhone.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['mobilePhone'],
      message: 'Escribí el celular.',
    });
  }
}

export const createRenterFormSchema = formShape
  .superRefine(requireIdentity)
  .transform(renterDraft)
  .pipe(createRenterSchema);
export const updateRenterFormSchema = formShape.transform(renterDraft).pipe(updateRenterSchema);
