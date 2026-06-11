import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MemberRole } from '@eatfit/shared';
import { api } from './api';

export interface BusinessSettings {
  name: string;
  slug: string;
  status: string;
  botStatus: string;
  botUsername: string | null;
  hasBotToken: boolean;
  topupTelegram: string | null;
  topupPhone: string | null;
  supportContact: string | null;
  languageDefault: string;
  tzOffsetHours: number;
  dailyReportHour: number;
  welcomeMessageRu: string | null;
  welcomeMessageUz: string | null;
}

export interface ChecklistItem {
  key: string;
  ok: boolean;
  label: string;
  hint?: string;
}

export interface BusinessChecklist {
  ready: boolean;
  items: ChecklistItem[];
}

export interface StaffMemberRow {
  id: string;
  clientId: string;
  name: string;
  phone: string | null;
  role: MemberRole;
  status: string;
  inviteLink: string | null;
}

export interface BusinessChatRow {
  kind: string;
  chatId: string | null;
  title: string | null;
  status: string | null;
}

export interface StaffBusiness {
  businessId: string;
  slug: string;
  name: string;
  role: MemberRole;
}

export interface StaffLoginResponse {
  accessToken: string;
  client: import('./types').ClientDto;
  businesses: StaffBusiness[];
}

export function useBusinessSettings() {
  return useQuery({
    queryKey: ['b', 'settings'],
    queryFn: () => api<BusinessSettings>('/b/settings'),
  });
}

export function useSaveBusinessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<BusinessSettings>) =>
      api<BusinessSettings>('/b/settings', { method: 'PUT', body }),
    onSuccess: (data) => qc.setQueryData(['b', 'settings'], data),
  });
}

export function useSetBotToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<BusinessSettings>('/b/bot-token', { method: 'POST', body: { token } }),
    onSuccess: (data) => {
      qc.setQueryData(['b', 'settings'], data);
      qc.invalidateQueries({ queryKey: ['b', 'checklist'] });
    },
  });
}

export function useRemoveBotToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BusinessSettings>('/b/bot-token', { method: 'DELETE' }),
    onSuccess: (data) => {
      qc.setQueryData(['b', 'settings'], data);
      qc.invalidateQueries({ queryKey: ['b', 'checklist'] });
    },
  });
}

export function useReconnectBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BusinessSettings>('/b/bot-token/reconnect', { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['b', 'settings'], data);
      qc.invalidateQueries({ queryKey: ['b', 'checklist'] });
    },
  });
}

export function useChecklist(poll = false) {
  return useQuery({
    queryKey: ['b', 'checklist'],
    queryFn: () => api<BusinessChecklist>('/b/checklist'),
    refetchInterval: poll ? 5000 : false,
  });
}

export function useStaffList() {
  return useQuery({
    queryKey: ['b', 'staff'],
    queryFn: () => api<StaffMemberRow[]>('/b/staff'),
  });
}

export function useInviteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; phone: string; role: MemberRole }) =>
      api<StaffMemberRow>('/b/staff', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b', 'staff'] }),
  });
}

export function useRemoveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/b/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b', 'staff'] }),
  });
}

export function useBusinessChats() {
  return useQuery({
    queryKey: ['b', 'chats'],
    queryFn: () => api<BusinessChatRow[]>('/b/chats'),
  });
}

/* ── platform admin ── */

export interface PlatformBusiness {
  id: string;
  slug: string;
  name: string;
  status: string;
  botStatus: string;
  botUsername: string | null;
  createdAt: string;
}

export interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  onboardingBusinesses: number;
  suspendedBusinesses: number;
  businessesWithBot: number;
  totalOrders: number;
  totalGmv: string;
  businesses: Array<{
    id: string;
    slug: string;
    name: string;
    orderCount: number;
    gmv: string;
    lastOrderAt: string | null;
  }>;
}

export interface AnalyticsDto {
  range: string;
  label: string;
  totalRevenue: string;
  orderCount: number;
  deliveredCount: number;
  averageOrderValue: string;
  revenueByPayment: Array<{ method: string; amount: string; orders: number }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  topItems: Array<{ name: string; quantity: number; revenue: string }>;
  customers: { newCustomers: number; repeatCustomers: number };
  offerFunnel: { sent: number; opened: number; ordered: number };
}

export function useAnalytics(range: 'today' | '7d' | '30d') {
  return useQuery({
    queryKey: ['b', 'analytics', range],
    queryFn: () => api<AnalyticsDto>(`/b/analytics?range=${range}`),
  });
}

export function usePlatformMetrics() {
  return useQuery({
    queryKey: ['platform', 'metrics'],
    queryFn: () => api<PlatformMetrics>('/platform/metrics'),
  });
}

export function usePlatformBusinesses() {
  return useQuery({
    queryKey: ['platform', 'businesses'],
    queryFn: () => api<PlatformBusiness[]>('/platform/businesses'),
  });
}

export function useCreateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      slug: string;
      ownerName: string;
      ownerPhone: string;
      ownerPassword: string;
    }) => api<PlatformBusiness>('/platform/businesses', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform'] });
    },
  });
}

export function useSuspendBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PlatformBusiness>(`/platform/businesses/${id}/suspend`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}

export function useActivateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<PlatformBusiness>(`/platform/businesses/${id}/activate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
  });
}
