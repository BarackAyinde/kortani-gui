import { create } from 'zustand'
import type { PanelInstance, PanelType, CanvasMode, LayoutPreset } from '../types'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'

const BASE_X = 80
const BASE_Y = 80
const CASCADE_OFFSET = 30
const BASE_Z = 10

function generateId(type: PanelType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function maxZIndex(panels: PanelInstance[]): number {
  return panels.reduce((max, p) => Math.max(max, p.zIndex), BASE_Z)
}

interface WindowManagerState {
  panels: PanelInstance[]
  canvasMode: CanvasMode
  activePreset: LayoutPreset | null

  spawnPanel: (
    type: PanelType,
    props?: Record<string, unknown>,
    position?: { x: number; y: number },
  ) => void
  closePanel: (id: string) => void
  focusPanel: (id: string) => void
  movePanel: (id: string, x: number, y: number) => void
  resizePanel: (id: string, w: number, h: number) => void
  minimizePanel: (id: string) => void
  toggleCanvasMode: () => void
  setActivePreset: (preset: LayoutPreset | null) => void
}

export const useWindowManagerStore = create<WindowManagerState>((set, get) => ({
  panels: [],
  canvasMode: 'free',
  activePreset: null,

  spawnPanel: (type, props = {}, position) => {
    const { panels } = get()
    const def = PANEL_REGISTRY[type]
    const count = panels.length
    const x = position?.x ?? BASE_X + (count % 8) * CASCADE_OFFSET
    const y = position?.y ?? BASE_Y + (count % 8) * CASCADE_OFFSET
    const zIndex = maxZIndex(panels) + 1

    const instance: PanelInstance = {
      id: generateId(type),
      type,
      x,
      y,
      width: def.defaultSize.w,
      height: def.defaultSize.h,
      zIndex,
      minimized: false,
      props,
    }

    set((state) => ({ panels: [...state.panels, instance] }))
  },

  closePanel: (id) =>
    set((state) => ({ panels: state.panels.filter((p) => p.id !== id) })),

  focusPanel: (id) =>
    set((state) => {
      const next = maxZIndex(state.panels) + 1
      return {
        panels: state.panels.map((p) =>
          p.id === id ? { ...p, zIndex: next } : p,
        ),
      }
    }),

  movePanel: (id, x, y) =>
    set((state) => ({
      panels: state.panels.map((p) => (p.id === id ? { ...p, x, y } : p)),
    })),

  resizePanel: (id, w, h) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, width: w, height: h } : p,
      ),
    })),

  minimizePanel: (id) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, minimized: !p.minimized } : p,
      ),
    })),

  toggleCanvasMode: () =>
    set((state) => ({
      canvasMode: state.canvasMode === 'free' ? 'dashboard' : 'free',
    })),

  setActivePreset: (preset) => set({ activePreset: preset }),
}))
