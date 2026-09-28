'use client';

import type { Customer, CustomerMatch } from '@elite/shared';
import { useFormContext } from 'react-hook-form';

import { FormField } from '@/components/ui/form';
import type { TicketFormInput, TicketFormOutput } from '../ticket-draft';
import { OwnerField } from './customer-field';

/**
 * El responsable del alta, atado al campo `customer` del formulario. La
 * pastilla, las sugerencias y el «¿Es el mismo?» en línea son de `OwnerField`
 * (028, 030, 047); esto solo le da el valor y le recibe los cambios.
 */
export function TicketCustomerField({
  scope,
  searchCustomers,
  matchCustomer,
  label,
}: {
  scope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  matchCustomer: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
  label?: string;
}) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();

  return (
    <FormField
      control={control}
      name="customer"
      render={({ field }) => (
        <OwnerField
          value={field.value}
          onChange={field.onChange}
          scope={scope}
          searchCustomers={searchCustomers}
          matchCustomer={matchCustomer}
          label={label}
          optional
        />
      )}
    />
  );
}
