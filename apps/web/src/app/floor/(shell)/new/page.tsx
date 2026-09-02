import type { Metadata } from 'next';

import { FloorNewTicket } from '@/features/floor/components/floor-new-ticket';

export const metadata: Metadata = { title: 'Anotar carro · Pista' };

export default function FloorNewPage() {
  return <FloorNewTicket />;
}
