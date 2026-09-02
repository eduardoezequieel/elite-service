'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Logo } from '@/components/brand/logo';
import { firstAllowedHref } from '@/components/app-shell/nav-items';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useSession } from '@/features/auth/hooks/use-session';

/**
 * La raiz no tiene contenido propio: manda al login o a la primera pestaña
 * que los permisos del usuario cubren. Nunca a una pantalla que no es suya.
 */
export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { can, isLoading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (isPending) return;
    if (session === null) {
      router.replace('/login');
      return;
    }
    if (permissionsLoading) return;

    const href = firstAllowedHref(can);
    if (href) router.replace(href);
  }, [isPending, permissionsLoading, session, can, router]);

  const waiting = isPending || (session !== null && permissionsLoading);
  const noScreens = session !== null && !permissionsLoading && firstAllowedHref(can) === null;

  return (
    <main className="bg-bg flex min-h-screen flex-col items-center justify-center gap-4">
      <Logo variant="mark" size={30} className="text-text-dim" />
      <p className="text-text-dim text-body">
        {waiting ? 'Cargando…' : noScreens ? 'No hay pantallas para tu usuario.' : 'Cargando…'}
      </p>
    </main>
  );
}
