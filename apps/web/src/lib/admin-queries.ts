import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Allergens, Category, Ingredient, Nutrition, OrderStatus, RecipeStep, Role } from '@eatfit/shared';
import { api, apiUpload } from './api';
import { ClientDto, MenuItemDto, OrderDto, SettingsDto } from './types';
import { useAuthStore } from '@/store/auth.store';
import { getBizSlug } from './biz';

export interface DishBody {
  category: Category;
  nameRu: string;
  nameUz: string;
  descriptionRu?: string;
  descriptionUz?: string;
  price: number;
  photoUrl?: string;
  isActive?: boolean;
  days?: number[];
  weightGrams?: number | null;
  price2?: number | null;
  weightGrams2?: number | null;
  orderDeadline?: string | null;
  ingredients?: Ingredient[] | null;
  allergens?: Allergens | null;
  nutrition?: Nutrition | null;
  nutrition2?: Nutrition | null;
  instructions?: RecipeStep[] | null;
  tipRu?: string | null;
  tipUz?: string | null;
}

/* ── заказы ── */
export function useAdminOrders(poll = true) {
  return useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => api<OrderDto[]>('/admin/orders'),
    refetchInterval: poll ? 15_000 : false,
  });
}
export function useTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: OrderStatus }) =>
      api<OrderDto>(`/admin/orders/${v.id}/status`, { method: 'POST', body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'orders'] }),
  });
}

/* ── публичный конфиг (юзернейм бота для deep-link) ── */
export function usePublicConfig() {
  // Активный бизнес: стафф-сессия (activeBusinessSlug) либо ?biz= в URL Mini App.
  const slug = useAuthStore((s) => s.activeBusinessSlug) ?? getBizSlug() ?? null;
  return useQuery({
    queryKey: ['config', slug],
    queryFn: () =>
      api<{ botUsername: string | null }>(
        slug ? `/config?biz=${encodeURIComponent(slug)}` : '/config',
      ),
    staleTime: 5 * 60 * 1000,
  });
}

/* ── меню ── */
export function useAdminMenu() {
  return useQuery({ queryKey: ['admin', 'menu'], queryFn: () => api<MenuItemDto[]>('/admin/menu') });
}
export function useCreateDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DishBody) => api<MenuItemDto>('/admin/menu', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function useUpdateDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Partial<DishBody> }) =>
      api<MenuItemDto>(`/admin/menu/${v.id}`, { method: 'PUT', body: v.body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function useSetDishActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      api<MenuItemDto>(`/admin/menu/${v.id}/active`, { method: 'PATCH', body: { isActive: v.isActive } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function useDeleteDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/admin/menu/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function useUploadDishPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; file: File }) =>
      apiUpload<MenuItemDto>(`/admin/menu/${v.id}/photo`, v.file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function useDeleteDishPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<MenuItemDto>(`/admin/menu/${id}/photo`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });
}
export function usePublishDish() {
  return useMutation({
    mutationFn: (id: string) =>
      api<{ published: true }>(`/admin/menu/${id}/publish`, { method: 'POST' }),
  });
}

export interface ComboSlotOptionBody {
  menuItemId: string;
  priceOverride?: string;
  isDefault?: boolean;
}

export interface ComboSlotBody {
  nameRu: string;
  nameUz: string;
  options: ComboSlotOptionBody[];
}

export interface ComboBody {
  nameRu: string;
  nameUz: string;
  descriptionRu?: string;
  descriptionUz?: string;
  price: string;
  originalPrice?: string | null;
  photoUrl?: string | null;
  isActive?: boolean;
  days?: number[];
  slots?: ComboSlotBody[];
  modifierGroupIds?: string[];
}

export interface AdminComboDetailDto {
  id: string;
  nameRu: string;
  nameUz: string;
  descriptionRu: string | null;
  descriptionUz: string | null;
  price: string;
  originalPrice: string | null;
  photoUrl: string | null;
  isActive: boolean;
  days: number[];
  modifierGroupIds: string[];
  slots: Array<{
    id: string;
    nameRu: string;
    nameUz: string;
    options: Array<{
      id: string;
      menuItemId: string;
      priceOverride: string;
      isDefault: boolean;
      menuItem?: { id: string; nameRu: string; nameUz: string };
    }>;
  }>;
}

export function useAdminCombos() {
  return useQuery({
    queryKey: ['b', 'combos'],
    queryFn: () =>
      api<Array<{ id: string; nameRu: string; nameUz: string; price: string; isActive: boolean }>>(
        '/b/combos',
      ),
  });
}

export function useAdminComboDetail(id: string | null) {
  return useQuery({
    queryKey: ['b', 'combos', id],
    queryFn: () => api<AdminComboDetailDto>(`/b/combos/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ComboBody) => api<AdminComboDetailDto>('/b/combos', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b', 'combos'] }),
  });
}

export function useUpdateCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: Partial<ComboBody> }) =>
      api<AdminComboDetailDto>(`/b/combos/${v.id}`, { method: 'PATCH', body: v.body }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['b', 'combos'] });
      qc.invalidateQueries({ queryKey: ['b', 'combos', v.id] });
    },
  });
}

export function usePublishCombo() {
  return useMutation({
    mutationFn: (id: string) =>
      api<{ published: true }>(`/admin/menu/combos/${id}/publish`, { method: 'POST' }),
  });
}

/* ── пользователи ── */
export function useAdminUsers(query: string) {
  return useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () =>
      api<ClientDto[]>(`/admin/clients${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  });
}
export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; role: Role }) =>
      api<ClientDto>(`/admin/clients/${v.id}/role`, { method: 'POST', body: { role: v.role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { clientId: string; amount: number }) =>
      api<{ balance: string }>('/admin/deposits', {
        method: 'POST',
        body: { ...v, idempotencyKey: crypto.randomUUID() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { clientId: string; amount: number }) =>
      api<{ balance: string }>('/admin/withdrawals', {
        method: 'POST',
        body: { ...v, idempotencyKey: crypto.randomUUID() },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

/* ── настройки ── */
export function useSettings() {
  return useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<SettingsDto>('/admin/settings') });
}
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SettingsDto>) =>
      api<SettingsDto>('/admin/settings', { method: 'PUT', body }),
    onSuccess: (data) => qc.setQueryData(['admin', 'settings'], data),
  });
}
