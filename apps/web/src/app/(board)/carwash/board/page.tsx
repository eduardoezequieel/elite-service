import type { Metadata } from 'next';

import { PERMISSIONS } from '@elite/shared';

import { PermissionDenied } from '@/features/auth/components/permission-denied';
import { RequirePermission } from '@/features/auth/components/require-permission';
import { BoardScreen } from '@/features/carwash/components/board-screen';

export const metadata: Metadata = {
  title: 'Pista · Elite Service',
  description: 'La pista en vivo: una columna por lavador, con su cronómetro.',
};

export default function CarwashBoardPage() {
  return (
    <RequirePermission
      permission={PERMISSIONS.carwash.actions.read.key}
      fallback={<PermissionDenied screen="el tablero de pista" />}
    >
      <BoardScreen />
    </RequirePermission>
  );
}
