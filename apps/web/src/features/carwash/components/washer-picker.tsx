'use client';

import { useFormContext } from 'react-hook-form';

import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form';
import type { TicketFormInput, TicketFormOutput } from '../ticket-draft';
import { AssigneeField, type AssigneeOption } from './assignee-field';

/**
 * «A cargo de» en el alta de oficina (035): un empleado o nadie. La pista no
 * lo dibuja, porque quien anota el carro queda asignado solo.
 */
export function WasherPicker({ employees }: { employees: readonly AssigneeOption[] }) {
  const { control } = useFormContext<TicketFormInput, unknown, TicketFormOutput>();

  return (
    <Card className="gap-3 px-card">
      <FormField
        control={control}
        name="employeeId"
        render={({ field }) => (
          <AssigneeField employees={employees} value={field.value} onChange={field.onChange} />
        )}
      />
      <p className="text-text-faint text-dense">
        Si no elegís a nadie, el lavado queda sin asignar.
      </p>
    </Card>
  );
}
