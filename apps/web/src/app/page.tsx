'use client';

import { AppGate } from '@/components/AppGate';
import { AppShell } from '@/components/AppShell';

export default function HomePage() {
  return (
    <AppGate>
      <AppShell />
    </AppGate>
  );
}
