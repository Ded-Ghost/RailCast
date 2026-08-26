import { create } from "zustand";

interface UIStoreState {
  isSidebarCollapsed: boolean;
  isMobileNavOpen: boolean;
  toggleSidebar: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
}

/** Layout-only UI state — never data. Data lives in useNetworkStore. */
export const useUIStore = create<UIStoreState>((set) => ({
  isSidebarCollapsed: false,
  isMobileNavOpen: false,
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),
}));
