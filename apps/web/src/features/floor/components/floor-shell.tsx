'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useFloorLogout, useFloorSession } from '../hooks/use-floor';

/**
 * Armazón de la vista pista.
 *
 * **No es el riel de oficina con botones más grandes.** No hay pestañas: la
 * pista tiene una sola cosa que hacer —la fila del día— y el empleado no
 * administra nada (RN-0). Una barra con el nombre y la salida, y el resto es
 * contenido.
 *
 * Fuerza densidad `bahía` mientras esté montado, sin importar el ancho: la
 * pista se trabaja de pie y con guantes aunque la tablet sea grande.
 */
export function FloorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useFloorSession();
  const logout = useFloorLogout();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.density;

    root.dataset.density = 'bahia';

    return () => {
      root.dataset.density = previous ?? 'mostrador';
    };
  }, []);

  useEffect(() => {
    if (!session.isPending && session.data === null) router.replace('/floor/login');
  }, [session.isPending, session.data, router]);

  if (session.isPending || session.data === null || session.data === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-body">Cargando…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-rule flex items-center justify-between gap-3 border-b px-4 py-3">
        <Link href="/floor" className="text-title">
          Pista
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-body">
            {session.data.employee.fullName}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => router.replace('/floor/login') })
            }
          >
            Salir
          </Button>
        </div>
      </header>

      <main className="flex-1 p-plate">{children}</main>
    </div>
  );
}
