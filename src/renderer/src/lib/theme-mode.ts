// Light/dark mode controller. The preference is stored in localStorage (synchronous, so we can apply
// it before first paint — no theme flash — unlike the async electron-store settings) and applied by
// stamping data-theme on <html>, which flips the CSS variables defined in assets/base.css.
import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'notely.theme'
const ACCENT_KEY = 'notely.accent'
// OKLCH hue (degrees) of the default rose accent — see assets/base.css.
export const DEFAULT_ACCENT_HUE = 6
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function getStoredMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return darkQuery.matches ? 'dark' : 'light'
  return mode
}

function apply(mode: ThemeMode): void {
  const resolved = resolveTheme(mode)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

export function setStoredMode(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
  apply(mode)
}

// --- Accent hue -------------------------------------------------------------
// The accent hue is independent of light/dark: it sets --accent-h on <html>, and base.css derives
// the primary accent (--blue) from it via OKLCH at a per-theme lightness/chroma. Only the primary
// accent tracks this — the functional colors (teal/amber/etc.) stay fixed.
export function getStoredHue(): number {
  const v = Number(localStorage.getItem(ACCENT_KEY))
  return Number.isFinite(v) && v >= 0 && v <= 360 ? v : DEFAULT_ACCENT_HUE
}

function applyAccent(hue: number): void {
  document.documentElement.style.setProperty('--accent-h', String(hue))
}

export function setStoredHue(hue: number): void {
  localStorage.setItem(ACCENT_KEY, String(hue))
  applyAccent(hue)
}

// Call once, before React renders, so the first paint already has the right theme + accent.
export function initTheme(): void {
  apply(getStoredMode())
  applyAccent(getStoredHue())
  // Follow the OS when the user's preference is "system".
  darkQuery.addEventListener('change', () => {
    if (getStoredMode() === 'system') apply('system')
  })
}

// React binding for the UI controls: current mode, the resolved light/dark it maps to, and a setter.
export function useThemeMode(): {
  mode: ThemeMode
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
} {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getStoredMode()))

  useEffect(() => {
    const onChange = (): void => setResolved(resolveTheme(getStoredMode()))
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback((next: ThemeMode): void => {
    setStoredMode(next)
    setModeState(next)
    setResolved(resolveTheme(next))
  }, [])

  return { mode, resolved, setMode }
}

// React binding for the accent-hue slider.
export function useAccentHue(): { hue: number; setHue: (hue: number) => void } {
  const [hue, setHueState] = useState<number>(getStoredHue)
  const setHue = useCallback((next: number): void => {
    setStoredHue(next)
    setHueState(next)
  }, [])
  return { hue, setHue }
}
