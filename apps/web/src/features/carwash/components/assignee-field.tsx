'use client';

import { Combobox } from '@/components/ui/combobox';

export type AssigneeOption = {
  id: string;
  fullName: string;
};

const UNASSIGNED = '';

/**
 * Un empleado, o nadie. Combobox de lista corta (034): oficina elige; la pista
 * no usa esta pieza (035).
 */
export function AssigneeField({
  employees,
  value,
  onChange,
  disabled = false,
}: {
  employees: readonly AssigneeOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const options = [
    { value: UNASSIGNED, label: 'Sin asignar' },
    ...employees.map((employee) => ({ value: employee.id, label: employee.fullName })),
  ];

  return (
    <Combobox
      label="A cargo de"
      options={options}
      value={value ?? UNASSIGNED}
      onChange={(next) => onChange(next === UNASSIGNED ? null : next)}
      disabled={disabled}
    />
  );
}
