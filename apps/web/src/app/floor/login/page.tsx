import type { Metadata } from 'next';

import { GaugeBackdrop } from '@/components/brand/gauge-backdrop';
import { FloorLoginForm } from '@/features/floor/components/floor-login-form';

export const metadata: Metadata = {
  title: 'Entrar a la pista · Elite Service',
  description: 'Entrá con tu usuario y tu PIN.',
};

/** La misma tarjeta que el login de oficina, pero para usuario y PIN. */
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
