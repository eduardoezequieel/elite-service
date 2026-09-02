import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { EmployeesScreen } from '@/features/employees/components/employees-screen';

export const metadata: Metadata = {
  title: 'Empleados · Elite Service',
  description: 'Quién trabaja en la pista.',
};

export default function EmployeesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.employees.actions.read.key}>
      <EmployeesScreen />
    </RequirePermission>
  );
}
