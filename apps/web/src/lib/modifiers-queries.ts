import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

export type ModifierSelectionType = 'SINGLE' | 'MULTIPLE';
export type ModifierPricingType = 'FREE' | 'PAID' | 'INCLUDED';
export type ModifierGroupKind = 'modifier' | 'addition';

export interface ModifierRow {
  id: string;
  nameRu: string;
  nameUz: string;
  priceDelta: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ModifierGroupRow {
  id: string;
  nameRu: string;
  nameUz: string;
  kind: ModifierGroupKind;
  selectionType: ModifierSelectionType;
  pricingType: ModifierPricingType;
  minSelect: number;
  maxSelect: number | null;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  modifiers: ModifierRow[];
}

export interface ModifierGroupBody {
  nameRu: string;
  nameUz: string;
  kind?: ModifierGroupKind;
  selectionType?: ModifierSelectionType;
  pricingType?: ModifierPricingType;
  minSelect?: number;
  maxSelect?: number | null;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ModifierBody {
  nameRu: string;
  nameUz: string;
  priceDelta?: string;
  isActive?: boolean;
  sortOrder?: number;
}

const GROUPS_KEY = ['b', 'modifiers'] as const;

export function useModifierGroupsAdmin() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => api<ModifierGroupRow[]>('/b/modifiers'),
  });
}

export function useCreateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ModifierGroupBody) =>
      api<ModifierGroupRow>('/b/modifiers/groups', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useUpdateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: ModifierGroupBody }) =>
      api<ModifierGroupRow>(`/b/modifiers/groups/${v.id}`, { method: 'PATCH', body: v.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useDeleteModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/b/modifiers/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useCreateModifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { groupId: string; body: ModifierBody }) =>
      api<ModifierRow>(`/b/modifiers/groups/${v.groupId}/items`, { method: 'POST', body: v.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useUpdateModifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { groupId: string; id: string; body: ModifierBody }) =>
      api<ModifierRow>(`/b/modifiers/groups/${v.groupId}/items/${v.id}`, {
        method: 'PATCH',
        body: v.body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useDeleteModifier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { groupId: string; id: string }) =>
      api<void>(`/b/modifiers/groups/${v.groupId}/items/${v.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

/** Привязка групп модификаторов к блюду (PUT /b/modifiers/menu/:menuItemId/groups). */
export function useSetMenuItemModifierGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { menuItemId: string; groupIds: string[] }) =>
      api<void>(`/b/modifiers/menu/${v.menuItemId}/groups`, {
        method: 'PUT',
        body: { groupIds: v.groupIds },
      }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['menu', v.menuItemId, 'modifier-groups'] });
    },
  });
}
