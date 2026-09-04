import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { RequirePermission } from '@/features/auth/components/require-permission';
import { CategoriesScreen } from '@/features/catalog/components/categories-screen';

export const metadata: Metadata = {
  title: 'Categorías · Elite Service',
  description: 'Categorías del catálogo de lavado.',
};

export default function CatalogCategoriesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.services.actions.read.key}>
      <CategoriesScreen />
    </RequirePermission>
  );
}
