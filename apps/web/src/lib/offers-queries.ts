'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CartDto, ClientDto, OrderDto } from '@/lib/types';

export interface OfferCompositionLine {
  kind: 'dish' | 'combo';
  menuItemId?: string;
  portion?: number;
  comboId?: string;
  slotSelections?: Record<string, string>;
  modifierIds: string[];
  quantity: number;
}

export interface OfferDto {
  id: string;
  status: string;
  composition: OfferCompositionLine[];
  descriptionRu: string | null;
  estimatedTotal: string;
  sentAt: string | null;
  createdAt: string;
}

export interface OfferDetailDto {
  offer: OfferDto;
  recipients: Array<{ id: string; clientId: string; status: string }>;
  counts: Record<string, number>;
}

export function useOffers() {
  return useQuery({
    queryKey: ['b', 'offers'],
    queryFn: () => api<OfferDto[]>('/b/offers'),
  });
}

export function useOfferDetail(id: string | null, options?: { pollWhileSending?: boolean }) {
  return useQuery({
    queryKey: ['b', 'offers', id],
    queryFn: () => api<OfferDetailDto>(`/b/offers/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      if (!options?.pollWhileSending) return false;
      const status = query.state.data?.offer.status;
      return status === 'sending' ? 2000 : false;
    },
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { composition: OfferCompositionLine[] }) =>
      api<OfferDto>('/b/offers', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b', 'offers'] }),
  });
}

/** Обновление черновика рассылки (PATCH вместо повторного POST — без дублей). */
export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; composition: OfferCompositionLine[] }) =>
      api<OfferDto>(`/b/offers/${v.id}`, { method: 'PATCH', body: { composition: v.composition } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['b', 'offers'] });
      qc.invalidateQueries({ queryKey: ['b', 'offers', v.id] });
    },
  });
}

/** Повторная отправка по получателям со статусом failed. */
export function useResendFailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ offerId: string; queued: number }>(`/b/offers/${id}/resend-failed`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['b', 'offers'] });
      qc.invalidateQueries({ queryKey: ['b', 'offers', id] });
    },
  });
}

export function useSendOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ offerId: string; queued: number }>(`/b/offers/${id}/send`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['b', 'offers'] });
      qc.invalidateQueries({ queryKey: ['b', 'offers', id] });
    },
  });
}

export function useSetOfferRecipients() {
  return useMutation({
    mutationFn: (v: { id: string; clientIds: string[] }) =>
      api(`/b/offers/${v.id}/recipients`, { method: 'POST', body: { clientIds: v.clientIds } }),
  });
}

export type OfferRecipientSegment = 'all' | 'has_balance' | 'ordered_30d' | 'never_ordered';

export function useSetOfferRecipientsBySegment() {
  return useMutation({
    mutationFn: (v: { id: string; segment: OfferRecipientSegment }) =>
      api<{ count: number; clientIds: string[] }>(`/b/offers/${v.id}/recipients/segment`, {
        method: 'POST',
        body: { segment: v.segment },
      }),
  });
}

export interface ClientCrmDetail extends ClientDto {
  ordersCount: number;
  lastOrderAt: string | null;
  lifetimeSpend: string;
  topItems: Array<{ name: string; quantity: number }>;
}

export function useClientCrm(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'clients', id, 'crm'],
    queryFn: () => api<ClientCrmDetail>(`/admin/clients/${id}/crm`),
    enabled: Boolean(id),
  });
}

export function useClientOrders(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'clients', id, 'orders'],
    queryFn: () => api<OrderDto[]>(`/admin/clients/${id}/orders`),
    enabled: Boolean(id),
  });
}

export function useModifierGroups() {
  return useQuery({
    queryKey: ['b', 'modifiers'],
    queryFn: () => api<Array<{ id: string; nameRu: string; modifiers: Array<{ id: string; nameRu: string; priceDelta: string }> }>>('/b/modifiers'),
  });
}

export function useCombos() {
  return useQuery({
    queryKey: ['combos'],
    queryFn: () => api<Array<{ id: string; nameRu: string; price: string }>>('/combos'),
  });
}

export function useAdminCombosForOffers() {
  return useQuery({
    queryKey: ['b', 'combos'],
    queryFn: () =>
      api<Array<{ id: string; nameRu: string; nameUz: string; price: string; isActive: boolean }>>(
        '/b/combos',
      ),
  });
}

export function useUpsertCartLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (line: OfferCompositionLine & { lineId?: string }) =>
      api<CartDto>('/cart/lines', { method: 'POST', body: line }),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
}

export function usePrefillOfferCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) =>
      api<CartDto>(`/cart/from-offer/${recipientId}`, { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(['cart'], data),
  });
}
