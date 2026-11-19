import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const THEME_KEY = 'scoutplay-theme';
const NAV_KEY = 'scoutplay-nav-hidden';
const THEME_COLORS = { dark: '#07111f', light: '#f2f5fa' };

const read = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* storage indisponível */ }
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (read(THEME_KEY) === 'light' ? 'light' : 'dark'));
  const [navHidden, setNavHidden] = useState(() => read(NAV_KEY) === '1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    write(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    write(NAV_KEY, navHidden ? '1' : '0');
  }, [navHidden]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const toggleNav = useCallback(() => setNavHidden((v) => !v), []);

  const value = useMemo(
    () => ({ theme, toggleTheme, navHidden, toggleNav }),
    [theme, toggleTheme, navHidden, toggleNav]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
