import axios from 'axios';
let csrf = null; // kept in memory only, never in localStorage
export const setCsrf = (t) => { csrf = t; };
const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api/v1', withCredentials: true });
api.interceptors.request.use((c) => { if (csrf && c.method !== 'get') c.headers['X-CSRF-Token'] = csrf; return c; });
api.interceptors.response.use((r) => r, (e) => { if (e.response?.status === 401 && !e.config.url.includes('/auth/')) window.dispatchEvent(new Event('auth:expired')); return Promise.reject(e); });
export default api;
