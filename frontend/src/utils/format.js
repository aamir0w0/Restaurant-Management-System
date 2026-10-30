// Currency model (mirrors backend/src/Services/Money.php): menu prices are in the BASE currency; orders are priced in the transaction CURRENCY.
let cfg = { currency: 'USD', base: 'USD', rate: 1 };
const ZERO = ['PKR', 'JPY', 'KRW', 'VND'];
const dec = (c) => (ZERO.includes(c) ? 0 : 2);
export const setCurrencyConfig = (s = {}) => { const cur = s.currency || 'USD'; const base = s.base_currency || cur; const rate = cur === base ? 1 : +s.exchange_rate > 0 ? +s.exchange_rate : 1; cfg = { currency: cur, base, rate }; };
export const currencyConfig = () => cfg;
/** base-currency amount -> transaction-currency amount, rounded exactly like the server */
export const toCur = (base) => { const d = dec(cfg.currency); const c = Math.round(Number(base || 0) * 100); return Math.round((c / 100) * cfg.rate * 10 ** d) / 10 ** d; };
export const roundCur = (x) => { const d = dec(cfg.currency); return Math.round(Number(x || 0) * 10 ** d) / 10 ** d; };
export const money = (v, cur) => { const c = cur || cfg.currency; try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, minimumFractionDigits: dec(c), maximumFractionDigits: dec(c) }).format(Number(v || 0)); } catch { return `${c} ${Number(v || 0).toFixed(dec(c))}`; } };
export const moneyBase = (v) => money(v, cfg.base);
export const dt = (s) => (s ? new Date(String(s).replace(' ', 'T')).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const errMsg = (e) => { const d = e?.response?.data; if (d?.errors && Object.keys(d.errors).length) return Object.entries(d.errors).map(([k, v]) => `${k}: ${v}`).join('; '); return d?.message || e?.message || 'Something went wrong'; };
export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
