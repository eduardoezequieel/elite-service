import type { Metadata } from 'next';

import { RolesScreen } from '@/features/roles/components/roles-screen';

export const metadata: Metadata = {
  title: 'Roles y permisos · Elite Service',
  description: 'Creá roles y marcá qué permisos tiene cada puesto del taller.',
};

/**
 * Solo capa de ruta: la tabla, la matriz de permisos y los diálogos viven en
 * `features/roles`. El layout de `(app)` ya exige sesión y permiso.
 */
export default function RolesPage() {
  return <RolesScreen />;
}
