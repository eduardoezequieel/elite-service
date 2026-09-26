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
import { FloorLiveProvider } from './floor-live-provider';
import { GaugeLoader } from '@/components/ui/gauge-loader';

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
        <GaugeLoader label="Entrando a la pista" />
      </main>
    );
  }

  // `data-density` también acá: los tokens de densidad son variables CSS y se
  // heredan, así que la pista es `bahia` aunque el DensityProvider resuelva
  // `mostrador` en el <html> (escritorio con puntero fino) después de este efecto.
  return (
    <FloorLiveProvider>
      <div data-density="bahia" className="bg-bg flex min-h-screen flex-col">
        <header className="border-line-soft bg-surface sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3">
          <Link
            href="/floor"
            className="text-text hover:text-flame-text inline-flex items-center gap-2.5 text-title transition-colors duration-(--duration-state) ease-standard"
          >
            <Logo height={36} />
            Lavado
          </Link>
          <div className="flex items-center gap-3">
            {/* En el celular el nombre se vuelve iniciales (066): así «Salir»
                no salta a otra línea con un nombre largo. */}
            <span className="text-text-dim text-body max-sm:hidden">
              {session.data.employee.fullName}
            </span>
            <span
              aria-label={session.data.employee.fullName}
              title={session.data.employee.fullName}
              className="bg-surface-3 text-text size-touch text-dense grid shrink-0 place-items-center rounded-full font-bold sm:hidden"
            >
              {initialsOf(session.data.employee.fullName)}
            </span>
            <Button type="button" variant="outline" onClick={() => setLeaving(true)}>
              Salir
            </Button>
          </div>
        </header>

        <main className="flex-1 p-plate">{children}</main>

        <Dialog open={leaving} onOpenChange={setLeaving}>
          <DialogContent className="md:max-w-md">
            <DialogHeader>
              <DialogTitle>¿Salir de lavado?</DialogTitle>
              <DialogDescription>
                Vas a tener que entrar otra vez con tu PIN. Los lavados activos no se tocan.
              </DialogDescription>
            </DialogHeader>
            {/* `flex-col` pisa el `flex-col-reverse` del pie: en la hoja táctil
              Seguir queda arriba, que es lo que el empleado quiere tocar. */}
            <DialogFooter className="flex-col">
              <Button type="button" variant="secondary" size="lg" onClick={() => setLeaving(false)}>
                Seguir
              </Button>
              <Button
                type="button"
                variant="destructiveSolid"
                size="lg"
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
    </FloorLiveProvider>
  );
}

/** «Eduardo López» → «EL». Dos letras alcanzan para reconocerse en la tablet. */
function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
