'use client';

import Link from 'next/link';
import { DashboardTab } from '@/components/backoffice/DashboardTab';
import { OnboardingBanner } from '@/components/backoffice/OnboardingBanner';

export default function BackofficeDashboardPage() {
  return (
    <>
      <OnboardingBanner />
      <DashboardTab />
    </>
  );
}
