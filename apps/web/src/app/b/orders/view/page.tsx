'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderDetailContent } from '@/components/admin/orders/OrderDetailContent';

function OrderViewInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return null;
  return <OrderDetailContent orderId={id} />;
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={null}>
      <OrderViewInner />
    </Suspense>
  );
}
