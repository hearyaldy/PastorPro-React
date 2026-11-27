import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type LightThemePreset = 'forest' | 'navy' | 'cobalt' | 'burgundy' | 'olive';

export const LIGHT_THEME_PRESETS: {
  id: LightThemePreset;
  label: string;
  canvas: string;
  sidebar: string;
  accent: string;
}[] = [
  { id: 'forest', label: 'Alabaster Forest', canvas: '#F2F0E9', sidebar: '#E6EAE2', accent: '#14532D' },
  { id: 'navy', label: 'Nordic Navy', canvas: '#E8EEF6', sidebar: '#D6E1F0', accent: '#1E3A8A' },
  { id: 'cobalt', label: 'Coastal Teal', canvas: '#E5F0EE', sidebar: '#CFE4E0', accent: '#0F766E' },
  { id: 'burgundy', label: 'Rosewood Parchment', canvas: '#F4EAEB', sidebar: '#E8D5D8', accent: '#881337' },
  { id: 'olive', label: 'Sandstone Olive', canvas: '#F1EDE0', sidebar: '#E2DAC2', accent: '#3F6212' },
];

interface ThemeContextValue {
  theme: Theme;
  lightTheme: LightThemePreset;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setLightTheme: (preset: LightThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'pastor_report_theme';
const LIGHT_STORAGE_KEY = 'pastor_report_light_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  const [lightTheme, setLightThemeState] = useState<LightThemePreset>(() => {
    try {
      const saved = localStorage.getItem(LIGHT_STORAGE_KEY);
      if (
        saved === 'forest' ||
        saved === 'navy' ||
        saved === 'cobalt' ||
        saved === 'burgundy' ||
        saved === 'olive'
      ) {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'forest';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-light-theme', lightTheme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
      localStorage.setItem(LIGHT_STORAGE_KEY, lightTheme);
    } catch {
      // ignore
    }
  }, [theme, lightTheme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const setLightTheme = (preset: LightThemePreset) => {
    setLightThemeState(preset);
    setThemeState('light');
  };
  const toggleTheme = () =>
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider
      value={{ theme, lightTheme, toggleTheme, setTheme, setLightTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
