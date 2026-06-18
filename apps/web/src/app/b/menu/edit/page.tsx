'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MenuFormContent } from '@/components/admin/menu';

function EditMenuInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return null;
  return <MenuFormContent itemId={id} />;
}

export default function EditMenuItemPage() {
  return (
    <Suspense fallback={null}>
      <EditMenuInner />
    </Suspense>
  );
}
