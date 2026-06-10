import { create } from 'zustand';

export type Tab = 'menu' | 'cart' | 'orders' | 'profile' | 'admin';

interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  // Открытая детальная карточка блюда (id) поверх вкладок; null — закрыта.
  detailId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

/** Активная вкладка Mini App (клиентский роутинг без next-router). */
export const useUiStore = create<UiState>((set) => ({
  tab: 'menu',
  setTab: (tab) => set({ tab }),
  detailId: null,
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),
}));
