'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ComboFormContent } from '@/components/admin/combos';

function EditComboInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return null;
  return <ComboFormContent comboId={id} />;
}

export default function EditComboPage() {
  return (
    <Suspense fallback={null}>
      <EditComboInner />
    </Suspense>
  );
}
