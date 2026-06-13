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
      qc.invalidateQueries({ queryKey: ['b', 'chats'] });
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
      qc.invalidateQueries({ queryKey: ['b', 'chats'] });
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
      qc.invalidateQueries({ queryKey: ['b', 'chats'] });
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

export function useResetChatBindings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BusinessChatRow[]>('/b/chats/reset', { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['b', 'chats'], data);
      qc.invalidateQueries({ queryKey: ['b', 'checklist'] });
    },
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
  revenueByDay: Array<{ date: string; amount: string; orders: number }>;
  priorPeriod: {
    totalRevenue: string;
    orderCount: number;
    deliveredCount: number;
    averageOrderValue: string;
    newCustomers: number;
  } | null;
}

export function useAnalytics(range: 'today' | '7d' | '30d') {
  return useQuery({
    queryKey: ['b', 'analytics', range],
    queryFn: () => api<AnalyticsDto>(`/b/analytics?range=${range}`),
    staleTime: 30_000,
  });
}

export function useUpdateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; role: MemberRole }) =>
      api<StaffMemberRow>(`/b/staff/${v.id}`, { method: 'PUT', body: { role: v.role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b', 'staff'] }),
  });
}

export function usePlatformMetrics(enabled = true) {
  return useQuery({
    queryKey: ['platform', 'metrics'],
    queryFn: () => api<PlatformMetrics>('/platform/metrics'),
    enabled,
  });
}

export function usePlatformBusinesses(enabled = true) {
  return useQuery({
    queryKey: ['platform', 'businesses'],
    queryFn: () => api<PlatformBusiness[]>('/platform/businesses'),
    enabled,
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
      ownerPassword?: string;
      tzOffsetHours?: number;
      dailyReportHour?: number;
    }) =>
      api<CreateBusinessResult>('/platform/businesses', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform'] });
    },
  });
}

export interface CreateBusinessResult {
  business: PlatformBusiness;
  owner: { name: string; phone: string; existingAccount: boolean };
  loginUrl: string;
}

export function usePlatformSetupStatus() {
  return useQuery({
    queryKey: ['platform', 'setup-status'],
    queryFn: () => api<{ needsSetup: boolean }>('/platform/setup-status', { token: '' }),
  });
}

export function usePlatformBusiness(id: string | null) {
  return useQuery({
    queryKey: ['platform', 'business', id],
    queryFn: () => api<PlatformBusiness>(`/platform/businesses/${id}`),
    enabled: Boolean(id),
  });
}

export function usePlatformBusinessHealth(id: string | null) {
  return useQuery({
    queryKey: ['platform', 'business-health', id],
    queryFn: () =>
      api<{ botStatus: string; botUsername: string | null; connected: boolean }>(
        `/platform/businesses/${id}/health`,
      ),
    enabled: Boolean(id),
  });
}

export function useUpdatePlatformBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; tzOffsetHours?: number; dailyReportHour?: number }) =>
      api<PlatformBusiness>(`/platform/businesses/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform'] }),
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
