import type { Metadata } from 'next';

import { FloorTicketDetail } from '@/features/floor/components/floor-ticket-detail';

export const metadata: Metadata = { title: 'Lavado · Pista' };

export default async function FloorTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <FloorTicketDetail id={id} />;
}
