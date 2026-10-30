import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setCsrf } from '../services/api';
import { setCurrencyConfig } from '../utils/format';
import { applyTheme } from '../utils/themes';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [perms, setPerms] = useState([]); const [loading, setLoading] = useState(true); const [settings, setSettings] = useState({});
  const apply = useCallback(async (d) => {
    setCsrf(d.csrf_token); setUser(d.user); setPerms(d.permissions);
    const s = await api.get('/settings').then((r) => r.data.data).catch(() => ({})); setSettings(s); setCurrencyConfig(s); applyTheme(s.ui_theme);
  }, []);
  useEffect(() => { api.get('/auth/me').then((r) => apply(r.data.data)).catch(() => {}).finally(() => setLoading(false)); }, [apply]);
  useEffect(() => { const h = () => { setUser(null); setPerms([]); setCsrf(null); }; window.addEventListener('auth:expired', h); return () => window.removeEventListener('auth:expired', h); }, []);
  const login = async (email, password) => { const r = await api.post('/auth/login', { email, password }); await apply(r.data.data); };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { setUser(null); setPerms([]); setCsrf(null); } };
  const can = (p) => !p || perms.includes(p);
  return <Ctx.Provider value={{ user, perms, can, loading, login, logout, settings, setSettings }}>{children}</Ctx.Provider>;
}
