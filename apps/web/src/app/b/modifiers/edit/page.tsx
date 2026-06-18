'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ModifierGroupFormContent } from '@/components/admin/modifiers';

function EditModifierInner() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return null;
  return <ModifierGroupFormContent groupId={id} />;
}

export default function EditModifierGroupPage() {
  return (
    <Suspense fallback={null}>
      <EditModifierInner />
    </Suspense>
  );
}
