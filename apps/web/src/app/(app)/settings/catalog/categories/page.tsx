import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { CategoriesScreen } from '@/features/catalog/components/categories-screen';
import { pageParam } from '@/lib/list-params';

export const metadata: Metadata = {
  title: 'Categorías · Elite Service',
  description: 'Categorías del catálogo de lavado.',
};

export default async function CatalogCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <RequirePermission
      permission={PERMISSIONS.services.actions.read.key}
      fallback={<PermissionDenied screen="las categorías" />}
    >
      <CategoriesScreen initialPage={pageParam(params.page)} />
    </RequirePermission>
  );
}
