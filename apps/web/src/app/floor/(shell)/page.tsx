import type { Metadata } from 'next';

import { FloorQueue } from '@/features/floor/components/floor-queue';

export const metadata: Metadata = {
  title: 'Lavados activos · Lavado',
  description: 'Los carros que faltan lavar hoy.',
};

export default function FloorPage() {
  return <FloorQueue />;
}
