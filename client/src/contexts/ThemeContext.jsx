import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [theme, setTheme] = useState(() => {
    return user?.settings?.theme || localStorage.getItem('chat_theme') || 'dark';
  });

  useEffect(() => {
    if (user?.settings?.theme) setTheme(user.settings.theme);
  }, [user?.settings?.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chat_theme', theme);
  }, [theme]);

  const setAppTheme = useCallback((t) => {
    setTheme(t);
    if (user) {
      updateUser({ ...user, settings: { ...user.settings, theme: t } });
    }
  }, [user, updateUser]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setAppTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
