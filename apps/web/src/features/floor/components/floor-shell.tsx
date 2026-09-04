'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [leaving, setLeaving] = useState(false);

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
      <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo variant="mark" size={30} className="text-text-dim" />
        <p className="text-text-dim text-body">Cargando…</p>
      </main>
    );
  }

  // `data-density` también acá: los tokens de densidad son variables CSS y se
  // heredan, así que la pista es `bahia` aunque el DensityProvider resuelva
  // `mostrador` en el <html> (escritorio con puntero fino) después de este efecto.
  return (
    <div data-density="bahia" className="bg-bg flex min-h-screen flex-col">
      <header className="border-line-soft bg-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3">
        <Link
          href="/floor"
          className="text-text hover:text-flame-text inline-flex items-center gap-2.5 text-title transition-colors duration-(--duration-state) ease-standard"
        >
          <Logo variant="mark" size={24} />
          Pista
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-text-dim text-body">{session.data.employee.fullName}</span>
          <Button type="button" variant="outline" onClick={() => setLeaving(true)}>
            Salir
          </Button>
        </div>
      </header>

      <main className="flex-1 p-plate">{children}</main>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Salir de la pista?</DialogTitle>
            <DialogDescription>
              Se cierra tu sesión de empleado. La fila sigue en el taller.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setLeaving(false)}>
              Seguir
            </Button>
            <Button
              type="button"
              variant="destructiveSolid"
              loading={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => router.replace('/floor/login'),
                })
              }
            >
              Salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
