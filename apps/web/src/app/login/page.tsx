import type { Metadata } from 'next';

import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión · Elite Service',
  description: 'Entrá al sistema del taller con tu correo y tu contraseña.',
};

/**
 * La unica pantalla del sistema sin riel de navegacion: una lamina centrada
 * sobre papel (DESIGN.md → Layout, spec 001 → UI → `/login`).
 *
 * Solo capa de ruta: el formulario, la sesion y la redireccion viven en
 * `features/auth`.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-plate">
      <LoginForm />
    </main>
  );
}
