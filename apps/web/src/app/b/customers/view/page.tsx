'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerDetailContent } from '@/components/admin/customers/CustomerContent';

function CustomerViewInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return null;
  return <CustomerDetailContent clientId={id} />;
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={null}>
      <CustomerViewInner />
    </Suspense>
  );
}
