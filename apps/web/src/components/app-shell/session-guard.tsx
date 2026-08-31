'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useSession } from '@/features/auth/hooks/use-session';

/**
 * La puerta del área autenticada.
 *
 * Sin sesión no se dibuja nada de lo que hay detrás: se manda a `/login` con
 * `replace`, para que el botón de volver no traiga de regreso a una pantalla que
 * no se puede ver.
 *
 * Mientras la sesión se resuelve muestra una sola línea. Es un instante: un
 * esqueleto elaborado parpadearía más de lo que informa.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending, error } = useSession();

  useEffect(() => {
    if (!isPending && session === null) {
      router.replace('/login');
    }
  }, [isPending, session, router]);

  if (error) {
    return <Notice>No se pudo verificar la sesión. Revisá la conexión con el servidor.</Notice>;
  }

  if (isPending || session === null || session === undefined) {
    return <Notice>Verificando sesión…</Notice>;
  }

  return <>{children}</>;
}

/** Una línea sobria, centrada sobre el papel. */
function Notice({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-plate">
      <p className="text-muted-foreground text-body" role="status">
        {children}
      </p>
    </main>
  );
}
