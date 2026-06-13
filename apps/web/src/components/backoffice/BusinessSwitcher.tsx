'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { switchBusiness, persistStaffSession } from '@/lib/staff-auth';
import { useT } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function BusinessSwitcher() {
  const t = useT();
  const qc = useQueryClient();
  const businesses = useAuthStore((s) => s.staffBusinesses);
  const activeSlug = useAuthStore((s) => s.activeBusinessSlug);
  const setStaffAuth = useAuthStore((s) => s.setStaffAuth);

  if (businesses.length <= 1) return null;

  const onSwitch = async (slug: string) => {
    if (slug === activeSlug) return;
    const res = await switchBusiness(slug);
    persistStaffSession(res.accessToken, businesses, slug);
    setStaffAuth(res.accessToken, res.client, businesses, slug);
    await qc.invalidateQueries();
  };

  return (
    <Select value={activeSlug ?? ''} onValueChange={(v) => void onSwitch(v)}>
      <SelectTrigger className="h-9 w-[min(180px,40vw)] text-xs">
        <SelectValue placeholder={t('bo_switch_business')} />
      </SelectTrigger>
      <SelectContent>
        {businesses.map((b) => (
          <SelectItem key={b.businessId} value={b.slug}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
