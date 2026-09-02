import type { Metadata } from 'next';

import { GaugeBackdrop } from '@/components/brand/gauge-backdrop';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión · Elite Service',
  description: 'Entrá al sistema del taller con tu correo y tu contraseña.',
};

/**
 * La unica pantalla del sistema sin riel de navegacion: una tarjeta centrada
 * sobre el azul marino, con el arco del medidor insinuado detras
 * (spec 005 → Login).
 *
 * Solo capa de ruta: el formulario, la sesion y la redireccion viven en
 * `features/auth`.
 */
export default function LoginPage() {
  return (
    <main className="bg-bg relative flex min-h-screen items-center justify-center overflow-hidden p-plate">
      <GaugeBackdrop />
      <LoginForm />
    </main>
  );
}
