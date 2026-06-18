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
    <div className="adm-banner">
      <span>{t('bo_onboarding_banner')}</span>
      <Button size="sm" asChild>
        <Link href="/b/onboarding/">{t('bo_onboarding_continue')}</Link>
      </Button>
    </div>
  );
}
