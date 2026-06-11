'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BackofficeIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/b/dashboard/');
  }, [router]);
  return null;
}
