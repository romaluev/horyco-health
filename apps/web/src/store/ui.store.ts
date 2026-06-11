import { create } from 'zustand';

export type Tab = 'menu' | 'cart' | 'orders' | 'profile';

interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  // Открытая детальная карточка блюда (id) поверх вкладок; null — закрыта.
  detailId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  comboId: string | null;
  openCombo: (id: string) => void;
  closeCombo: () => void;
}

/** Активная вкладка Mini App (клиентский роутинг без next-router). */
export const useUiStore = create<UiState>((set) => ({
  tab: 'menu',
  setTab: (tab) => set({ tab }),
  detailId: null,
  openDetail: (id) => set({ detailId: id, comboId: null }),
  closeDetail: () => set({ detailId: null }),
  comboId: null,
  openCombo: (id) => set({ comboId: id, detailId: null }),
  closeCombo: () => set({ comboId: null }),
}));
