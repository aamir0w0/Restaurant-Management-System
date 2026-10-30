import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, ReceiptText, ChefHat, Armchair, UtensilsCrossed, Tags, Users, Boxes, Truck, Wallet, BarChart3, ShieldCheck, Settings as Cog, ScrollText, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Bell, LogOut, Search, X, KeyRound, CalendarDays, PackagePlus, Globe, CreditCard } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Modal, Field, Button } from '../components/ui';
import OrderAlert from '../components/OrderAlert';
import { dt, errMsg } from '../utils/format';
// [path, label, icon, permission]
const NAV = [
  ['/', 'Dashboard', LayoutDashboard, 'dashboard.view'], ['/pos', 'Point of Sale', ShoppingCart, 'orders.create'], ['/orders', 'Orders', ReceiptText, 'orders.view'], ['/kitchen', 'Kitchen', ChefHat, 'kitchen.view'],
  ['/payments', 'Payments', CreditCard, 'payments.view'], ['/tables', 'Tables', Armchair, 'tables.view'], ['/reservations', 'Reservations', CalendarDays, 'reservations.manage'], ['/menu', 'Menu', UtensilsCrossed, 'menu.view'],
  ['/categories', 'Categories', Tags, 'menu.view'], ['/customers', 'Customers (CRM)', Users, 'customers.view'], ['/inventory', 'Inventory', Boxes, 'inventory.view'], ['/purchases', 'Purchasing', PackagePlus, 'purchases.manage'],
  ['/suppliers', 'Suppliers', Truck, 'suppliers.manage'], ['/expenses', 'Expenses', Wallet, 'expenses.view'], ['/reports', 'Reports', BarChart3, 'reports.view'], ['/users', 'Users & Roles', ShieldCheck, 'users.manage'],
  ['/settings', 'Settings', Cog, 'settings.view'], ['/audit', 'Audit Log', ScrollText, 'audit.view'],
];
const LINKS = { order: '/orders', payment: '/payments', reservation: '/reservations', purchase: '/purchases', low_stock: '/inventory' };
function beep() { try { const C = window.AudioContext || window.webkitAudioContext; const c = new C(); [880, 1175].forEach((f, i) => { const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = f; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.0001, c.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + i * 0.18 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.18 + 0.16); o.start(c.currentTime + i * 0.18); o.stop(c.currentTime + i * 0.18 + 0.18); }); } catch { /* sound is optional */ } }
function Nav({ collapsed, onNavigate }) {
  const { can } = useAuth();
  return <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">{NAV.filter((n) => can(n[3])).map(([to, text, Icon]) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} title={collapsed ? text : undefined} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-primary text-white shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
      <Icon size={18} className="shrink-0" />{!collapsed && <span className="truncate">{text}</span>}
    </NavLink>))}</nav>;
}
export default function AppLayout() {
  const { user, logout, settings } = useAuth(); const loc = useLocation(); const nav = useNavigate(); const [term, setTerm] = useState('');
  const [collapsed, setCollapsed] = useState(false); const [drawer, setDrawer] = useState(false); const [bellOpen, setBell] = useState(false); const [menuOpen, setMenu] = useState(false); const [pw, setPw] = useState(false);
  const [notes, setNotes] = useState({ items: [], unread: 0, by_type: {} }); const [showOld, setShowOld] = useState(false); const [alerts, setAlerts] = useState([]);
  const loadNotes = useCallback(() => api.get('/notifications').then((r) => setNotes(r.data.data)).catch(() => {}), []);
  useEffect(() => { loadNotes(); const t = setInterval(loadNotes, 8000); return () => clearInterval(t); }, [loadNotes]);
  // Instant new-order alert: a long-poll request that the server answers the moment an order is created.
  useEffect(() => {
    let stop = false; const ctl = new AbortController(); let after = '';
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    (async () => {
      while (!stop) {
        try {
          const d = (await api.get('/notifications/new-orders', { params: { after }, signal: ctl.signal, timeout: 35000 })).data.data;
          const first = after === ''; after = d.last_id;
          if (!first && d.items.length) { setAlerts((a) => [...a, ...d.items.map((n) => ({ id: n.id, message: n.message, number: (n.message.match(/ORD-\d{8}-\d{4}/) || [])[0] }))]); beep(); loadNotes(); }
        } catch (e) { if (stop) return; const st = e.response?.status; if (st === 401 || st === 403) return; await wait(2000); }
      }
    })();
    return () => { stop = true; ctl.abort(); };
  }, [loadNotes]);
  useEffect(() => { setDrawer(false); setBell(false); setMenu(false); }, [loc.pathname]);
  const open = (n) => { api.post(`/notifications/${n.id}/read`).then(loadNotes).catch(() => {}); setBell(false); const num = (n.message.match(/ORD-\d{8}-\d{4}/) || [])[0]; nav(num ? `/orders?q=${num}` : LINKS[n.type] || '/'); };
  const readAll = () => api.post('/notifications/read-all').then(loadNotes);
  const shown = notes.items.filter((n) => showOld || !n.is_read); const alert = alerts[0];
  const closeAlert = () => { if (alert) api.post(`/notifications/${alert.id}/read`).then(loadNotes).catch(() => {}); setAlerts((a) => a.slice(1)); };
  const viewAlert = () => { const a = alert; closeAlert(); nav(a.number ? `/orders?q=${a.number}` : '/orders'); };
  const fullBleed = loc.pathname === '/pos' || loc.pathname === '/kitchen';
  const Brand = ({ c }) => <div className="flex h-16 items-center gap-2.5 px-4 text-white"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary"><UtensilsCrossed size={18} /></span>{!c && <span className="truncate text-lg font-semibold tracking-tight">{settings.restaurant_name || 'Restaurant'}</span>}</div>;
  return (
    <div className="flex h-full">
      <aside className={`hidden shrink-0 flex-col bg-sidebar transition-all lg:flex ${collapsed ? 'w-16' : 'w-60'}`}><Brand c={collapsed} /><Nav collapsed={collapsed} />
        {!collapsed && <a href="/store" target="_blank" rel="noreferrer" className="mx-3 mb-2 rounded-xl bg-white/10 p-3 text-white transition hover:bg-white/15"><p className="flex items-center gap-2 text-sm font-semibold"><Globe size={15} />Online ordering site</p><p className="mt-0.5 text-xs text-white/60">Open your customer storefront</p></a>}
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 px-5 py-3 text-sm text-white/70 hover:text-white" aria-label="Toggle sidebar">{collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} />Collapse</>}</button></aside>
      {drawer && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} /><aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar pb-[env(safe-area-inset-bottom)]"><div className="flex items-center justify-between pr-3"><Brand /><button onClick={() => setDrawer(false)} className="text-white" aria-label="Close menu"><X /></button></div><Nav onNavigate={() => setDrawer(false)} /></aside></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-3 pt-[env(safe-area-inset-top)] sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-2"><button className="rounded p-2 text-muted hover:bg-canvas lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><MenuIcon size={20} /></button>
            <form onSubmit={(e) => { e.preventDefault(); if (term.trim()) nav('/orders?q=' + encodeURIComponent(term.trim())); }} className="relative w-full max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search orders by number, customer or phone…" className="input rounded-xl bg-canvas pl-9" /></form></div>
          <div className="flex items-center gap-1">
            <div className="relative"><button onClick={() => { setBell(!bellOpen); setMenu(false); }} className="relative rounded-lg p-2 text-muted hover:bg-canvas" aria-label="Notifications"><Bell size={19} /></button>
              {bellOpen && <div className="absolute right-0 z-30 mt-2 w-96 max-w-[92vw] rounded-2xl border border-line bg-white shadow-pop"><div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm font-semibold">Notifications<button className="ml-auto text-xs font-medium text-primary" onClick={readAll}>Mark all read</button></div>
                <div className="max-h-96 overflow-y-auto">{shown.length === 0 ? <p className="p-8 text-center text-sm text-muted">You are all caught up</p> : shown.map((n) => <button key={n.id} onClick={() => open(n)} className={`block w-full border-b border-line px-4 py-3 text-left text-sm last:border-0 hover:bg-canvas ${n.is_read ? 'opacity-60' : 'bg-primary-soft/40'}`}><span className="flex items-start gap-2">{!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}<span className="flex-1">{n.message}<span className="block text-xs text-muted">{dt(n.created_at)}</span></span></span></button>)}</div>
                <button onClick={() => setShowOld(!showOld)} className="w-full border-t border-line py-2.5 text-xs font-medium text-muted hover:text-ink">{showOld ? 'Hide earlier notifications' : 'Show earlier notifications'}</button></div>}</div>
            <div className="relative"><button onClick={() => { setMenu(!menuOpen); setBell(false); }} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-canvas"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{user.name[0]}</span><span className="hidden text-left text-xs sm:block"><span className="block font-medium">{user.name}</span><span className="text-muted">{user.role_label}</span></span></button>
              {menuOpen && <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-line bg-white py-1 shadow-lg"><button onClick={() => { setPw(true); setMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-canvas"><KeyRound size={15} />Change password</button><button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-canvas"><LogOut size={15} />Sign out</button></div>}</div>
          </div>
        </header>
        <main className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? 'p-0' : 'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6'}`}><Outlet /></main>
      </div>
      {alert && <OrderAlert key={alert.id} alert={alert} remaining={alerts.length - 1} onView={viewAlert} onClose={closeAlert} />}
      <PasswordModal open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
function PasswordModal({ open, onClose }) {
  const [f, setF] = useState({ current_password: '', new_password: '' }); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/auth/change-password', f); toast.success('Password changed'); setF({ current_password: '', new_password: '' }); onClose(); } catch (er) { toast.error(errMsg(er)); } finally { setBusy(false); } };
  return <Modal open={open} onClose={onClose} title="Change password"><form onSubmit={submit} className="space-y-4"><Field label="Current password"><input type="password" className="input" required value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} autoComplete="current-password" /></Field><Field label="New password (min 10 characters)"><input type="password" minLength={10} className="input" required value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} autoComplete="new-password" /></Field><div className="flex justify-end"><Button type="submit" loading={busy}>Update</Button></div></form></Modal>;
}