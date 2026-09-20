import type { Metadata } from 'next';

import { GaugeBackdrop } from '@/components/brand/gauge-backdrop';
import { FloorLoginForm } from '@/features/floor/components/floor-login-form';

export const metadata: Metadata = {
  title: 'Entrar a lavado · Elite Service',
  description: 'Entrá con tu PIN.',
};

/** La misma tarjeta que el login de oficina, pero con el teclado del PIN (044). */
export default function FloorLoginPage() {
  return (
    <main
      data-density="bahia"
      className="bg-bg relative flex min-h-screen items-center justify-center overflow-hidden p-plate"
    >
      <GaugeBackdrop />
      <FloorLoginForm />
    </main>
  );
}
