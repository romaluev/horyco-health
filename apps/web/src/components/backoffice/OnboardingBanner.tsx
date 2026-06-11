'use client';

import Link from 'next/link';
import { useBusinessSettings } from '@/lib/backoffice-queries';
import { useT } from '@/lib/i18n';

export function OnboardingBanner() {
  const t = useT();
  const { data: settings } = useBusinessSettings();

  if (!settings || settings.status !== 'onboarding') return null;

  return (
    <div className="adm-banner">
      <span>{t('bo_onboarding_banner')}</span>
      <Link href="/b/onboarding/" className="adm-btn adm-btn-sm adm-btn-primary">
        {t('bo_onboarding_continue')}
      </Link>
    </div>
  );
}
