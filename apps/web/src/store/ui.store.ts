import { create } from 'zustand';

export type Tab = 'menu' | 'cart' | 'orders' | 'profile';

interface UiState {
  tab: Tab;
  setTab: (tab: Tab) => void;
  // Открытая детальная карточка блюда (id) поверх вкладок; null — закрыта.
  detailId: string | null;
  editLineId: string | null;
  openDetail: (id: string, opts?: { editLineId?: string }) => void;
  closeDetail: () => void;
  comboId: string | null;
  editComboLineId: string | null;
  openCombo: (id: string, opts?: { editLineId?: string }) => void;
  closeCombo: () => void;
  offerDetailsId: string | null;
  openOfferDetails: (id: string) => void;
  closeOfferDetails: () => void;
}

/** Активная вкладка Mini App (клиентский роутинг без next-router). */
export const useUiStore = create<UiState>((set) => ({
  tab: 'menu',
  setTab: (tab) => set({ tab }),
  detailId: null,
  editLineId: null,
  openDetail: (id, opts) =>
    set({ detailId: id, editLineId: opts?.editLineId ?? null, comboId: null, offerDetailsId: null }),
  closeDetail: () => set({ detailId: null, editLineId: null }),
  comboId: null,
  editComboLineId: null,
  openCombo: (id, opts) =>
    set({ comboId: id, editComboLineId: opts?.editLineId ?? null, detailId: null, offerDetailsId: null }),
  closeCombo: () => set({ comboId: null, editComboLineId: null }),
  offerDetailsId: null,
  openOfferDetails: (id) => set({ offerDetailsId: id, detailId: null, comboId: null }),
  closeOfferDetails: () => set({ offerDetailsId: null }),
}));
