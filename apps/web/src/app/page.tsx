'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/hooks/use-session';

/**
 * La raiz no tiene contenido propio: manda a donde corresponda segun haya
 * sesion o no. Cuando exista la primera pantalla de negocio de verdad, este
 * destino cambia.
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending) return;

    router.replace(session === null ? '/login' : '/settings/users');
  }, [isPending, session, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-body">Cargando…</p>
    </main>
  );
}
