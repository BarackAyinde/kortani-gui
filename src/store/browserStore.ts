import { create } from 'zustand'

interface BrowserState {
  // URL currently loaded in the BrowserPanel iframe
  currentUrl: string
  // True when Kortana has navigated (vs. manual user navigation)
  kortanaDriving: boolean
  // Latest scrape result markdown (for display/summary purposes)
  lastScrapeMarkdown: string | null

  navigateTo: (url: string, byKortana?: boolean) => void
  setLastScrape: (markdown: string) => void
  clearKortanaDriving: () => void
}

export const useBrowserStore = create<BrowserState>((set) => ({
  currentUrl: 'about:blank',
  kortanaDriving: false,
  lastScrapeMarkdown: null,

  navigateTo: (url, byKortana = false) =>
    set({ currentUrl: url, kortanaDriving: byKortana }),

  setLastScrape: (markdown) => set({ lastScrapeMarkdown: markdown }),

  clearKortanaDriving: () => set({ kortanaDriving: false }),
}))
