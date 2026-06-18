'use client';

import { useSearchParams } from 'next/navigation';
import { CreateOrderTab } from '@/components/backoffice/CreateOrderTab';

export default function BackofficeCreateOrderPage() {
  const sp = useSearchParams();
  const clientId = sp.get('clientId');
  const initialClientIds = clientId ? [clientId] : [];
  return <CreateOrderTab initialClientIds={initialClientIds} />;
}
