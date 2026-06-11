'use client';

import { useAuthStore } from '@/store/auth.store';
import { switchBusiness, persistStaffSession } from '@/lib/staff-auth';
import { useT } from '@/lib/i18n';

export function BusinessSwitcher() {
  const t = useT();
  const businesses = useAuthStore((s) => s.staffBusinesses);
  const activeSlug = useAuthStore((s) => s.activeBusinessSlug);
  const setStaffAuth = useAuthStore((s) => s.setStaffAuth);

  if (businesses.length <= 1) return null;

  const onSwitch = async (slug: string) => {
    if (slug === activeSlug) return;
    const res = await switchBusiness(slug);
    persistStaffSession(res.accessToken, businesses, slug);
    setStaffAuth(res.accessToken, res.client, businesses, slug);
    window.location.reload();
  };

  return (
    <div className="field" style={{ marginBottom: 16 }}>
      <label>{t('bo_switch_business')}</label>
      <select
        className="input"
        value={activeSlug ?? ''}
        onChange={(e) => void onSwitch(e.target.value)}
      >
        {businesses.map((b) => (
          <option key={b.businessId} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
