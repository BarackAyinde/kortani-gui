import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  paletteOpen: boolean
  togglePalette: () => void
  setPaletteOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  paletteOpen: false,
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
}))
