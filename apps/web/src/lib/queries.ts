import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Language, PaymentMethod } from '@eatfit/shared';
import { api } from './api';
import { CartDto, ClientDto, MenuItemDto, OrderDto } from './types';
import { useAuthStore } from '@/store/auth.store';

/** Витрина меню (активные блюда). */
export function useMenu() {
  return useQuery({ queryKey: ['menu'], queryFn: () => api<MenuItemDto[]>('/menu') });
}

/** Одно блюдо по id (для детальной карточки — в т.ч. по deep-link из бота). */
export function useMenuItem(id: string | null) {
  return useQuery({
    queryKey: ['menu', id],
    queryFn: () => api<MenuItemDto>(`/menu/${id}`),
    enabled: Boolean(id),
  });
}

export function useCart() {
  return useQuery({ queryKey: ['cart'], queryFn: () => api<CartDto>('/cart') });
}

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: () => api<OrderDto[]>('/orders') });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: string | { menuItemId: string; portion?: number }) => {
      const { menuItemId, portion } = typeof v === 'string' ? { menuItemId: v, portion: 1 } : v;
      return api<CartDto>('/cart/items', {
        method: 'POST',
        body: { menuItemId, quantity: 1, portion: portion ?? 1 },
      });
    },
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
}

export function useSetQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { menuItemId: string; quantity: number; portion?: number }) =>
      api<CartDto>(`/cart/items/${v.menuItemId}`, {
        method: 'PATCH',
        body: { quantity: v.quantity, portion: v.portion ?? 1 },
      }),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { paymentMethod: PaymentMethod; comment?: string }) =>
      api<OrderDto>('/orders', { method: 'POST', body: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export type ProfilePatch = Partial<{
  name: string;
  phone: string;
  address: string;
  language: Language;
}>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setClient = useAuthStore((s) => s.setClient);
  return useMutation({
    mutationFn: (dto: ProfilePatch) => api<ClientDto>('/me', { method: 'PUT', body: dto }),
    onSuccess: (client) => {
      setClient(client);
      qc.setQueryData(['me'], client);
    },
  });
}
