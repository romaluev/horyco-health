import { MemberRole } from '@eatfit/shared';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Layers,
  Tag,
  SlidersHorizontal,
  Users,
  Settings,
  Rocket,
  Building2,
  PlusCircle,
  UserCog,
  MoreHorizontal,
} from 'lucide-react';

export type BackofficeNavId =
  | 'dashboard'
  | 'orders'
  | 'menu'
  | 'combos'
  | 'offers'
  | 'modifiers'
  | 'customers'
  | 'settings'
  | 'onboarding'
  | 'staff'
  | 'more';

export interface NavItem {
  id: BackofficeNavId;
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Empty = all staff with backoffice access */
  roles?: MemberRole[];
  /** Show in mobile bottom tab bar */
  primary?: boolean;
}

export const BACKOFFICE_NAV: NavItem[] = [
  { id: 'dashboard', href: '/b/dashboard/', labelKey: 'dash_title', icon: LayoutDashboard, primary: true },
  { id: 'orders', href: '/b/orders/', labelKey: 'adm_orders', icon: ShoppingBag, primary: true },
  {
    id: 'offers',
    href: '/b/offers/',
    labelKey: 'bo_offers',
    icon: Tag,
    roles: [MemberRole.Owner, MemberRole.Manager],
    primary: true,
  },
  {
    id: 'customers',
    href: '/b/customers/',
    labelKey: 'adm_users',
    icon: Users,
    roles: [MemberRole.Owner, MemberRole.Manager],
    primary: true,
  },
  {
    id: 'menu',
    href: '/b/menu/',
    labelKey: 'adm_menu',
    icon: UtensilsCrossed,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
  {
    id: 'combos',
    href: '/b/combos/',
    labelKey: 'bo_combos',
    icon: Layers,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
  {
    id: 'modifiers',
    href: '/b/modifiers/',
    labelKey: 'bo_modifiers',
    icon: SlidersHorizontal,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
  {
    id: 'staff',
    href: '/b/staff/',
    labelKey: 'bo_staff',
    icon: UserCog,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
  {
    id: 'onboarding',
    href: '/b/onboarding/',
    labelKey: 'bo_onboarding',
    icon: Rocket,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
  {
    id: 'settings',
    href: '/b/settings/',
    labelKey: 'adm_settings',
    icon: Settings,
    roles: [MemberRole.Owner, MemberRole.Manager],
  },
];

/** Bottom tab bar items (mobile). */
export const BACKOFFICE_PRIMARY_NAV: NavItem[] = BACKOFFICE_NAV.filter((i) => i.primary);

/** Secondary nav shown in drawer / More sheet. */
export const BACKOFFICE_SECONDARY_NAV: NavItem[] = BACKOFFICE_NAV.filter((i) => !i.primary);

export const BACKOFFICE_MORE_ITEM: NavItem = {
  id: 'more',
  href: '#more',
  labelKey: 'bo_nav_more',
  icon: MoreHorizontal,
  primary: true,
};

export interface PlatformNavItem {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export const PLATFORM_NAV: PlatformNavItem[] = [
  { id: 'dashboard', href: '/platform/', labelKey: 'platform_nav_dashboard', icon: LayoutDashboard },
  { id: 'businesses', href: '/platform/businesses/', labelKey: 'platform_nav_businesses', icon: Building2 },
  { id: 'new', href: '/platform/businesses/new/', labelKey: 'platform_nav_create', icon: PlusCircle },
];

export function filterNavForRole(items: NavItem[], role: MemberRole | null, isPlatform: boolean): NavItem[] {
  if (isPlatform) return items;
  if (!role) return items.filter((i) => i.id === 'orders');
  return items.filter((item) => {
    if (!item.roles?.length) return true;
    return item.roles.includes(role);
  });
}

export function filterPrimaryNavForRole(role: MemberRole | null, isPlatform: boolean): NavItem[] {
  const primary = filterNavForRole(BACKOFFICE_PRIMARY_NAV, role, isPlatform);
  const hasSecondary = filterNavForRole(BACKOFFICE_SECONDARY_NAV, role, isPlatform).length > 0;
  if (hasSecondary && !primary.some((i) => i.id === 'more')) {
    return [...primary, BACKOFFICE_MORE_ITEM];
  }
  return primary;
}
