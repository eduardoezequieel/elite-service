import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { EmployeesScreen } from '@/features/employees/components/employees-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Empleados · Elite Service',
  description: 'Quién trabaja en el lavado.',
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.employees.actions.read.key}
      fallback={<PermissionDenied screen="los empleados" />}
    >
      <EmployeesScreen initialPage={pageParam(params.page)} />
    </RequirePermission>
  );
}
