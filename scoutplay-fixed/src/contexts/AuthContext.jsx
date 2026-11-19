import { createContext, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) return setReady(true);
    api('/me').then((d) => setUser(d.user)).catch(() => clearToken()).finally(() => setReady(true));
  }, []);

  const finish = (d, remember) => { setToken(d.token, remember); setUser(d.user); };
  const login = async (email, password, remember = true) => finish(await api('/login', { method: 'POST', json: { email, password } }), remember);
  const register = async (name, email, password, role, remember = true) => finish(await api('/register', { method: 'POST', json: { name, email, password, role } }), remember);
  const logout = () => { clearToken(); setUser(null); };

  if (!ready) return null;
  return <AuthContext.Provider value={{ user, setUser, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
