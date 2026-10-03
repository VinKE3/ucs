'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem('ucs_theme') as Theme) || 'system';
    setThemeState(savedTheme);

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (currentTheme: Theme) => {
      let resolved: ResolvedTheme = 'dark';
      if (currentTheme === 'system') {
        resolved = mql.matches ? 'dark' : 'light';
      } else {
        resolved = currentTheme;
      }
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    updateTheme(savedTheme);

    const handleMediaChange = () => {
      const active = (localStorage.getItem('ucs_theme') as Theme) || 'system';
      if (active === 'system') {
        updateTheme('system');
      }
    };

    mql.addEventListener('change', handleMediaChange);
    return () => mql.removeEventListener('change', handleMediaChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('ucs_theme', newTheme);
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const resolved: ResolvedTheme =
      newTheme === 'system' ? (mql.matches ? 'dark' : 'light') : newTheme;
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
