import type { UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import type { rentalSettingsFormSchema, RentalSettingsFormValues } from '../settings-form';

/** El formulario de Ajustes (120), compartido por las cuatro pestañas. */
export type SettingsFormApi = UseFormReturn<
  RentalSettingsFormValues,
  unknown,
  z.output<typeof rentalSettingsFormSchema>
>;

/** Para `setValue`: el cambio cuenta y se valida en el momento. */
export const EDIT = { shouldDirty: true, shouldValidate: true } as const;

/** Quitar algo de una lista deja un Deshacer en el aviso. */
export type NotifyUndo = (title: string, undo: () => void) => void;
