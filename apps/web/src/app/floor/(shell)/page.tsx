import type { Metadata } from 'next';

import { FloorQueue } from '@/features/floor/components/floor-queue';

export const metadata: Metadata = {
  title: 'La fila · Pista',
  description: 'Los carros que faltan lavar hoy.',
};

export default function FloorPage() {
  return <FloorQueue />;
}
