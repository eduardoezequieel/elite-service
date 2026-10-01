import type { ReactNode } from 'react';

import { SessionGuard } from '@/components/app-shell/session-guard';

/**
 * Layout de las vistas de impresión (097): la misma sesión que la oficina,
 * pero **sin `<AppShell>`** ni hilo en vivo. Es una hoja carta sobre la mesa:
 * ni riel ni barra inferior, que además saldrían en el papel. El fondo claro
 * y las medidas del papel los pone la propia vista.
 */
export default function PrintLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SessionGuard>{children}</SessionGuard>;
}
