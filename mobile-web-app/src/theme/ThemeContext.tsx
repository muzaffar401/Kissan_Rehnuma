import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ColorPalette, lightColors, darkColors } from './colors';
import { tokenStorage } from '../services/tokenStorage';

// Storage key
const DARK_MODE_KEY = 'kissan_setting_dark_mode';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorPalette;
  toggleTheme: () => Promise<void>;
  setTheme: (dark: boolean) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
  toggleTheme: async () => {},
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await tokenStorage.getSetting(DARK_MODE_KEY, false);
        setIsDark(saved);
      } catch {
        // ignore — default to light
      }
      setReady(true);
    })();
  }, []);

  const toggleTheme = useCallback(async () => {
    setIsDark((prev) => {
      const next = !prev;
      tokenStorage.setSetting(DARK_MODE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const setTheme = useCallback(async (dark: boolean) => {
    setIsDark(dark);
    await tokenStorage.setSetting(DARK_MODE_KEY, dark).catch(() => {});
  }, []);

  // While loading the theme preference, render with light mode
  if (!ready) {
    return (
      <ThemeContext.Provider value={{ isDark: false, colors: lightColors, toggleTheme, setTheme }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors: isDark ? darkColors : lightColors,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme colors and toggle function.
 *
 * Usage:
 *   const { colors, isDark, toggleTheme } = useTheme();
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
