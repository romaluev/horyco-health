'use client';

import { BackofficeLayout } from '@/components/admin-shell/BackofficeLayout';

export default function BLayout({ children }: { children: React.ReactNode }) {
  return <BackofficeLayout>{children}</BackofficeLayout>;
}
