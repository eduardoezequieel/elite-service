import type { Metadata } from 'next';

import { UsersScreen } from '@/features/users/components/users-screen';

export const metadata: Metadata = {
  title: 'Usuarios · Elite Service',
};

/**
 * `src/app/` es solo capa de rutas: la pantalla vive en `features/users` y acá
 * no hay lógica. El layout de `(app)` es el que exige sesión.
 */
export default function UsersPage() {
  return <UsersScreen />;
}
