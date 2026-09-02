import type { Metadata } from 'next';

import { FloorLoginForm } from '@/features/floor/components/floor-login-form';

export const metadata: Metadata = {
  title: 'Entrar a la pista · Elite Service',
  description: 'Entrá con tu usuario y tu PIN.',
};

/** Lámina centrada, igual que el login de oficina pero para usuario y PIN. */
export default function FloorLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-plate">
      <FloorLoginForm />
    </main>
  );
}
