import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({ baseURL: '/api' });

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('chat_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('chat_token'));
  const [loading, setLoading] = useState(true);

  /* Restore session */
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem('chat_token');
      if (!saved) { setLoading(false); return; }
      try {
        const { data } = await API.get('/auth/me');
        setUser(data.user);
        setToken(saved);
      } catch {
        localStorage.removeItem('chat_token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    localStorage.setItem('chat_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (username, email, password, phone) => {
    const { data } = await API.post('/auth/register', { username, email, password, phone });
    localStorage.setItem('chat_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chat_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await API.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, refreshUser, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { API };
