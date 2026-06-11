import { normalizePhone } from '@eatfit/shared';
import { api } from './api';
import { useAuthStore } from '@/store/auth.store';
import { StaffLoginResponse } from './backoffice-queries';

const STAFF_TOKEN_PREFIX = 'eatfit-staff-token';
const STAFF_BIZ_KEY = 'eatfit-staff-businesses';
const STAFF_SLUG_KEY = 'eatfit-staff-slug';

export function staffTokenKey(slug: string): string {
  return `${STAFF_TOKEN_PREFIX}:${slug}`;
}

function saveStaffMeta(businesses: StaffLoginResponse['businesses'], slug: string) {
  try {
    localStorage.setItem(STAFF_BIZ_KEY, JSON.stringify(businesses));
    localStorage.setItem(STAFF_SLUG_KEY, slug);
  } catch {
    /* ignore */
  }
}

function loadStaffMeta(): { businesses: StaffLoginResponse['businesses']; slug: string | null } {
  try {
    const raw = localStorage.getItem(STAFF_BIZ_KEY);
    const slug = localStorage.getItem(STAFF_SLUG_KEY);
    return { businesses: raw ? (JSON.parse(raw) as StaffLoginResponse['businesses']) : [], slug };
  } catch {
    return { businesses: [], slug: null };
  }
}

export function getSavedStaffToken(slug: string): string | null {
  try {
    return localStorage.getItem(staffTokenKey(slug));
  } catch {
    return null;
  }
}

export function saveStaffToken(token: string | null, slug: string) {
  try {
    const key = staffTokenKey(slug);
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function persistStaffSession(
  token: string,
  businesses: StaffLoginResponse['businesses'],
  slug: string,
) {
  saveStaffToken(token, slug);
  saveStaffMeta(businesses, slug);
}

/** Полная очистка стафф-сессии: токены по всем известным slug + мета. */
export function clearStaffSession() {
  try {
    const { businesses, slug } = loadStaffMeta();
    const slugs = new Set<string>();
    if (slug) slugs.add(slug);
    for (const b of businesses) if (b.slug) slugs.add(b.slug);
    for (const s of slugs) localStorage.removeItem(staffTokenKey(s));
    localStorage.removeItem(STAFF_BIZ_KEY);
    localStorage.removeItem(STAFF_SLUG_KEY);
  } catch {
    /* ignore */
  }
}

export async function staffLogin(phone: string, password: string): Promise<StaffLoginResponse> {
  return api<StaffLoginResponse>('/auth/staff-login', {
    method: 'POST',
    body: { phone: normalizePhone(phone), password },
    token: '',
  });
}

export async function switchBusiness(biz: string): Promise<{ accessToken: string; client: import('./types').ClientDto }> {
  return api('/auth/switch-business', {
    method: 'POST',
    body: { biz },
  });
}

export async function bootstrapStaffSession(): Promise<boolean> {
  const store = useAuthStore.getState();
  const { businesses, slug: savedSlug } = loadStaffMeta();
  const slug = savedSlug ?? businesses[0]?.slug;
  if (!slug) return false;

  const saved = getSavedStaffToken(slug);
  if (!saved) return false;

  store.setStatus('loading');
  try {
    const client = await api<import('./types').ClientDto>('/me', { token: saved });
    store.setStaffAuth(saved, client, businesses.length ? businesses : [{ businessId: '', slug, name: slug, role: 'owner' as import('@eatfit/shared').MemberRole }], slug);
    return true;
  } catch {
    saveStaffToken(null, slug);
    store.setStatus('web-anon');
    return false;
  }
}
