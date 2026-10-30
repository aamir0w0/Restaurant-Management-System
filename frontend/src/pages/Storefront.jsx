import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, UtensilsCrossed, MapPin, Phone, CheckCircle2, Clock, CreditCard, Banknote, Loader2, Search, Truck, Store, Radio, ShieldCheck, ChefHat, MessageCircle, ChevronDown, Star } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { Button, Modal, Field, Badge, Empty } from '../components/ui';
import { Customize } from './POS';
import { money, toCur, roundCur, setCurrencyConfig, errMsg, label } from '../utils/format';
import { applyTheme } from '../utils/themes';

function usePublic() {
  const [cfg, setCfg] = useState(null); const [menu, setMenu] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { Promise.all([api.get('/public/config'), api.get('/public/menu')]).then(([c, m]) => { setCurrencyConfig(c.data.data); applyTheme(c.data.data.ui_theme); setCfg(c.data.data); setMenu(m.data.data); document.title = c.data.data.restaurant_name || 'Order online'; }).catch((e) => setErr(errMsg(e))); }, []);
  return { cfg, menu, err };
}
const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const Shell = ({ cfg, children, right }) => (
  <div className="min-h-full bg-canvas">
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <Link to="/store" className="flex items-center gap-2.5 font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><UtensilsCrossed size={18} /></span><span className="truncate">{cfg?.restaurant_name || 'Order online'}</span></Link>
      {cfg && <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">{[['menu', 'Menu'], ['how', 'How it works'], ['about', 'About'], ['contact', 'Contact']].map(([id, t]) => <button key={id} onClick={() => go(id)} className="hover:text-ink">{t}</button>)}</nav>}{right}</div></header>
    {children}
  </div>
);
const Card3 = ({ m, onAdd, disabled, big }) => (
  <article className="group overflow-hidden rounded-2xl border border-line bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop">
    <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-soft to-accent-soft ${big ? 'h-48' : 'h-40'}`}>{m.image_path ? <img src={`/${m.image_path}`} alt={m.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /> : <span className="text-6xl font-semibold text-primary/30">{m.name[0]}</span>}
      {m.popular && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white"><Star size={12} />Popular</span>}</div>
    <div className="p-4"><h3 className="font-semibold">{m.name}</h3><p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{m.description || 'Freshly prepared to order.'}</p>
      <div className="mt-3 flex items-center justify-between"><span className="text-lg font-semibold text-primary">{money(toCur(m.base_price))}</span><Button size="sm" disabled={disabled} onClick={() => onAdd(m)}><Plus size={14} />Add</Button></div></div></article>
);
export default function Storefront() {
  const { cfg, menu, err } = usePublic(); const nav = useNavigate();
  const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [cart, setCart] = useState([]); const [pick, setPick] = useState(null); const [open, setOpen] = useState(false); const [checkout, setCheckout] = useState(false);
  const [mode, setMode] = useState('pickup'); const [cust, setCust] = useState({ name: '', phone: '', email: '' }); const [address, setAddress] = useState(''); const [notes, setNotes] = useState(''); const [pay, setPay] = useState('cash'); const [busy, setBusy] = useState(false); const [idem] = useState(() => crypto.randomUUID());
  const unit = (l) => toCur(+l.item.base_price + (l.variant ? +l.variant.price_delta : 0) + l.mods.reduce((s, m) => s + +m.price, 0));
  const sub = cart.reduce((s, l) => s + unit(l) * l.qty, 0); const tax = cfg ? roundCur(sub * cfg.tax_rate / 100) : 0; const del = cfg && mode === 'delivery' ? toCur(cfg.delivery_charge) : 0; const total = sub + tax + del; const qty = cart.reduce((s, l) => s + l.qty, 0);
  const all = useMemo(() => (menu?.items || []).map((m) => ({ ...m, popular: menu.popular.includes(m.id) })), [menu]);
  const items = useMemo(() => all.filter((m) => (!cat || String(m.category_id) === cat) && m.name.toLowerCase().includes(q.toLowerCase())), [all, cat, q]);
  const popular = useMemo(() => all.filter((m) => m.popular), [all]);
  const add = (l) => { setCart((c) => { const k = `${l.item.id}-${l.variant?.id}-${l.mods.map((m) => m.id).sort()}-${l.notes}`; const ex = c.find((x) => x.key === k); return ex ? c.map((x) => (x.key === k ? { ...x, qty: x.qty + 1 } : x)) : [...c, { ...l, key: k, qty: 1 }]; }); setPick(null); toast.success('Added to your order', { autoClose: 900, hideProgressBar: true }); };
  const tap = (m) => (m.variants.length || m.modifier_groups.length ? setPick(m) : add({ item: m, variant: null, mods: [], notes: '' }));
  const place = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api.post('/public/orders', { order_type: mode === 'pickup' ? 'takeaway' : 'delivery', customer: cust, delivery_address: address, notes, pay_method: pay, idempotency_key: idem,
        items: cart.map((l) => ({ menu_item_id: l.item.id, variant_id: l.variant?.id, modifier_ids: l.mods.map((m) => m.id), quantity: l.qty, notes: l.notes })) });
      const d = r.data.data; if (d.payment_error) toast.warn(d.payment_error);
      if (d.checkout_url) { window.location.href = d.checkout_url; return; }
      nav(`/store/track/${d.order_number}?phone=${encodeURIComponent(d.phone)}`);
    } catch (x) { toast.error(errMsg(x)); setBusy(false); }
  };
  if (err) return <Shell><div className="py-24 text-center text-red-600">{err}</div></Shell>;
  if (!cfg || !menu) return <Shell><div className="flex justify-center py-32 text-muted"><Loader2 className="animate-spin" /></div></Shell>;
  const open_ = cfg.ordering_enabled;
  const Cart = (
    <div className="space-y-3">
      {cart.length === 0 ? <Empty text="Your order is empty" /> : cart.map((l) => (
        <div key={l.key} className="rounded-xl border border-line p-3 text-sm"><div className="flex justify-between gap-2"><div><p className="font-medium">{l.item.name}{l.variant && <span className="text-muted"> · {l.variant.name}</span>}</p>{l.mods.length > 0 && <p className="text-xs text-accent">{l.mods.map((m) => m.name).join(', ')}</p>}</div><p className="font-semibold">{money(unit(l) * l.qty)}</p></div>
          <div className="mt-2 flex items-center gap-2"><button className="rounded-lg border border-line p-1.5" aria-label="Less" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))}><Minus size={14} /></button><span className="w-6 text-center">{l.qty}</span><button className="rounded-lg border border-line p-1.5" aria-label="More" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x)))}><Plus size={14} /></button><button className="ml-auto text-muted hover:text-red-600" aria-label="Remove" onClick={() => setCart(cart.filter((x) => x.key !== l.key))}><Trash2 size={15} /></button></div></div>))}
      {cart.length > 0 && <div className="space-y-1 border-t border-line pt-3 text-sm"><div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(sub)}</span></div>{tax > 0 && <div className="flex justify-between text-muted"><span>Tax</span><span>{money(tax)}</span></div>}{del > 0 && <div className="flex justify-between text-muted"><span>Delivery</span><span>{money(del)}</span></div>}<div className="flex justify-between text-base font-semibold"><span>Total</span><span>{money(total)}</span></div>
        <Button size="lg" className="mt-2 w-full" onClick={() => { setOpen(false); setCheckout(true); }}>Checkout</Button></div>}
    </div>
  );
  const badges = [[Store, 'Pickup or delivery'], [Radio, 'Live order tracking'], [Banknote, 'Pay on pickup / delivery'], ...(cfg.card_payments ? [[ShieldCheck, 'Secure online card payment']] : [])];
  const steps = [[Search, 'Choose your food', 'Browse the menu and customise each dish to your taste.'], [ShoppingBag, 'Place your order', 'Enter your details, pick pickup or delivery and how you want to pay.'], [Radio, 'Track it live', 'Follow your order from the kitchen to your hands with a live status page.']];
  const faqs = [['How can I track my order?', 'After you place an order you are taken to a live tracking page. You can reopen it any time with your order number and the phone number you used.'], ['What payment options are available?', cfg.card_payments ? 'You can pay online by card, or pay in cash when you pick up or receive your order.' : 'You can pay in cash when you pick up or receive your order.'], ['Can I change or cancel my order?', cfg.phone ? `Please call us on ${cfg.phone} as soon as possible and we will help.` : 'Please contact the restaurant as soon as possible and we will help.'], ['Is delivery available?', cfg.delivery_enabled ? 'Yes, choose Delivery at checkout and enter your address. Any delivery charge is shown before you confirm.' : 'Delivery is not available right now. Pickup is open.']];
  return (
    <Shell cfg={cfg} right={<button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover"><ShoppingBag size={16} />{qty > 0 ? `${qty} · ${money(sub)}` : 'Cart'}</button>}>
      <section className="relative overflow-hidden bg-sidebar text-white"><div className="absolute -right-20 -top-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl" /><div className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24"><p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/80"><ChefHat size={14} />Order online</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">{cfg.tagline || 'Fresh, hot and made to order'}</h1>
          <p className="mt-4 max-w-xl text-white/70">{cfg.about || 'Order your favourites for pickup or delivery in just a few taps.'}</p>
          <div className="mt-8 flex flex-wrap gap-3"><button disabled={!open_} onClick={() => go('menu')} className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50">{open_ ? 'Order now' : 'Currently closed'}</button>{cfg.phone && <a href={`tel:${cfg.phone}`} className="flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold transition hover:bg-white/10"><Phone size={16} />Call us</a>}</div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75">{badges.map(([I, t]) => <span key={t} className="flex items-center gap-2"><I size={16} className="text-accent" />{t}</span>)}</div>
          {!open_ && <p className="mt-6 inline-block rounded-xl bg-accent px-4 py-3 text-sm font-medium">Online ordering is currently closed. Please check back soon.</p>}</div></section>
      {popular.length > 0 && <section className="mx-auto max-w-6xl px-4 pt-12"><div className="mb-5"><p className="text-sm font-medium text-accent">Customer favourites</p><h2 className="text-2xl font-semibold">Popular right now</h2></div><div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">{popular.map((m) => <Card3 key={m.id} m={m} onAdd={tap} disabled={!open_} big />)}</div></section>}
      <section id="menu" className="scroll-mt-16 pt-12"><div className="mx-auto max-w-6xl px-4"><p className="text-sm font-medium text-accent">Our menu</p><h2 className="text-2xl font-semibold">Explore the full menu</h2></div>
        <div className="sticky top-16 z-20 mt-4 border-y border-line bg-white"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3"><div className="flex flex-1 gap-2 overflow-x-auto">{[{ id: '', name: 'All' }, ...menu.categories].map((c) => <button key={c.id} onClick={() => setCat(String(c.id))} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${cat === String(c.id) ? 'bg-primary text-white' : 'bg-canvas text-muted hover:text-ink'}`}>{c.name}</button>)}</div>
          <div className="relative hidden w-56 sm:block"><Search size={15} className="absolute left-3 top-2.5 text-muted" /><input className="input rounded-full pl-9" placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} /></div></div></div>
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">{items.map((m) => <Card3 key={m.id} m={m} onAdd={tap} disabled={!open_} />)}{items.length === 0 && <div className="col-span-full"><Empty text="No dishes found" /></div>}</div></section>
      <section id="how" className="scroll-mt-16 bg-white py-16"><div className="mx-auto max-w-6xl px-4"><div className="mb-10 text-center"><p className="text-sm font-medium text-accent">Simple and quick</p><h2 className="text-2xl font-semibold">How it works</h2></div>
        <div className="grid gap-6 md:grid-cols-3">{steps.map(([I, t, d], i) => <div key={t} className="rounded-2xl border border-line bg-canvas p-6 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white"><I size={24} /></span><p className="text-xs font-semibold text-accent">STEP {i + 1}</p><h3 className="mt-1 font-semibold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></div>)}</div></div></section>
      <section id="about" className="scroll-mt-16 mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-2"><div><p className="text-sm font-medium text-accent">About us</p><h2 className="text-2xl font-semibold">{cfg.restaurant_name}</h2><p className="mt-3 text-muted">{cfg.about || 'We prepare every order fresh in our kitchen.'}</p></div>
        <div id="contact" className="scroll-mt-20 space-y-3 rounded-2xl border border-line bg-white p-6 shadow-card"><h3 className="font-semibold">Visit or contact us</h3>{cfg.address && <p className="flex gap-3 text-sm"><MapPin size={18} className="shrink-0 text-primary" />{cfg.address}</p>}{cfg.phone && <p className="flex gap-3 text-sm"><Phone size={18} className="shrink-0 text-primary" /><a href={`tel:${cfg.phone}`}>{cfg.phone}</a></p>}{cfg.hours && <p className="flex gap-3 text-sm"><Clock size={18} className="shrink-0 text-primary" />{cfg.hours}</p>}{cfg.delivery_enabled && <p className="flex gap-3 text-sm"><Truck size={18} className="shrink-0 text-primary" />Delivery available</p>}</div></section>
      <section className="mx-auto max-w-3xl px-4 pb-20"><h2 className="mb-5 text-center text-2xl font-semibold">Frequently asked questions</h2><div className="space-y-3">{faqs.map(([qq, a]) => <details key={qq} className="group rounded-xl border border-line bg-white p-4 shadow-card"><summary className="flex cursor-pointer list-none items-center justify-between font-medium">{qq}<ChevronDown size={18} className="transition group-open:rotate-180" /></summary><p className="mt-3 text-sm text-muted">{a}</p></details>)}</div></section>
      <footer className="bg-sidebar py-8 text-center text-sm text-white/60"><p className="font-medium text-white">{cfg.restaurant_name}</p><p className="mt-1">{[cfg.address, cfg.phone].filter(Boolean).join(' · ')}</p></footer>
      {cfg.wa_number && <a href={`https://wa.me/${cfg.wa_number}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className={`fixed right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-pop transition hover:scale-105 ${qty > 0 ? 'bottom-24 sm:bottom-4' : 'bottom-4'}`}><MessageCircle size={22} /></a>}
      {qty > 0 && <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-primary px-5 py-3.5 font-medium text-white shadow-pop sm:hidden"><span className="flex items-center gap-2"><ShoppingBag size={18} />{qty} items</span><span>{money(sub)}</span></button>}
      <Modal open={open} onClose={() => setOpen(false)} title="Your order">{Cart}</Modal>
      {pick && <Customize item={pick} onClose={() => setPick(null)} onAdd={add} />}
      <Modal open={checkout} onClose={() => setCheckout(false)} title="Checkout" wide><form onSubmit={place} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">{[['pickup', 'Pickup'], ['delivery', 'Delivery']].map(([k, l]) => <button type="button" key={k} disabled={k === 'delivery' && !cfg.delivery_enabled} onClick={() => setMode(k)} className={`rounded-xl border px-4 py-3 text-sm font-medium disabled:opacity-40 ${mode === k ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}>{l}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Your name"><input className="input" required value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></Field><Field label="Phone (WhatsApp)"><input className="input" required type="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field></div>
        <Field label="Email (optional)"><input className="input" type="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} /></Field>
        {mode === 'delivery' && <Field label="Delivery address"><input className="input" required value={address} onChange={(e) => setAddress(e.target.value)} /></Field>}
        <Field label="Notes for the kitchen (optional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div><p className="label">Payment</p><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setPay('cash')} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${pay === 'cash' ? 'border-primary bg-primary-soft' : 'border-line'}`}><Banknote size={16} />Pay on {mode === 'pickup' ? 'pickup' : 'delivery'}</button>
          {cfg.card_payments && <button type="button" onClick={() => setPay('card')} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${pay === 'card' ? 'border-primary bg-primary-soft' : 'border-line'}`}><CreditCard size={16} />Pay online by card</button>}</div></div>
        <div className="flex items-center justify-between border-t border-line pt-3"><div><p className="text-xs text-muted">Total (confirmed by the restaurant)</p><p className="text-xl font-semibold">{money(total)}</p></div><Button type="submit" size="lg" loading={busy} disabled={!cart.length}>{pay === 'card' ? 'Continue to payment' : 'Place order'}</Button></div></form></Modal>
    </Shell>
  );
}
const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
export function Track() {
  const { number } = useParams(); const [sp] = useSearchParams(); const phone = sp.get('phone') || ''; const { cfg } = usePublic(); const [o, setO] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { let on = true; const load = () => api.get(`/public/orders/${encodeURIComponent(number)}`, { params: { phone } }).then((r) => { if (on) setO(r.data.data); }).catch((e) => on && setErr(errMsg(e))); load(); const t = setInterval(load, 8000); return () => { on = false; clearInterval(t); }; }, [number, phone]);
  const idx = o ? Math.max(0, STEPS.indexOf(o.status === 'served' ? 'completed' : o.status)) : 0;
  return (
    <Shell cfg={cfg} right={<Link to="/store" className="text-sm text-primary">Back to menu</Link>}>
      <div className="mx-auto max-w-xl space-y-4 px-4 py-8">
        {err ? <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</div> : !o ? <div className="flex justify-center py-20 text-muted"><Loader2 className="animate-spin" /></div> : (<>
          <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-card"><CheckCircle2 className="mx-auto text-primary" size={40} /><h1 className="mt-2 text-xl font-semibold">Order {o.order_number}</h1><p className="text-sm text-muted">{label(o.order_type === 'takeaway' ? 'pickup' : o.order_type)}</p>
            {o.status === 'cancelled' ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">This order was cancelled. Please contact the restaurant.</p> : <div className="mt-6 flex items-center justify-between">{STEPS.map((s, i) => <div key={s} className="flex flex-1 flex-col items-center gap-1"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i <= idx ? 'bg-primary text-white' : 'bg-canvas text-muted'}`}>{i < idx ? <CheckCircle2 size={16} /> : i + 1}</span><span className={`text-[11px] ${i <= idx ? 'font-medium' : 'text-muted'}`}>{{ pending: 'Received', accepted: 'Confirmed', preparing: 'Preparing', ready: 'Ready', completed: 'Done' }[s]}</span></div>)}</div>}
            <div className="mt-5 flex justify-center gap-2"><Badge value={o.payment_status} />{sp.get('paid') && o.payment_status !== 'paid' && <span className="flex items-center gap-1 text-xs text-muted"><Clock size={13} />Confirming your payment…</span>}</div></div>
          <div className="rounded-2xl border border-line bg-white p-5 text-sm shadow-card">{o.items.map((i, k) => <div key={k} className="flex justify-between py-1"><span>{i.quantity} × {i.item_name}{i.variant_name ? ` (${i.variant_name})` : ''}</span><span>{money(i.line_total, o.currency)}</span></div>)}
            <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold"><span>Total</span><span>{money(o.total, o.currency)}</span></div></div></>)}
      </div>
    </Shell>
  );
}
