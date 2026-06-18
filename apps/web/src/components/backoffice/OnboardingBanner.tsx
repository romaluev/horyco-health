'use client';

import Link from 'next/link';
import { useBusinessSettings } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function OnboardingBanner() {
  const t = useT();
  const { data: settings } = useBusinessSettings();

  if (!settings || settings.status !== 'onboarding') return null;

  return (
    <div className="bg-primary/5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <span>{t('bo_onboarding_banner')}</span>
      <Button size="sm" asChild>
        <Link href="/b/onboarding/">{t('bo_onboarding_continue')}</Link>
      </Button>
    </div>
  );
}
