import { useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, ImageOff } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { Button, Modal, Spinner, ErrorState, Empty } from '../components/ui';
import { OrderModal } from './Orders';
import { money, toCur, roundCur, errMsg, label } from '../utils/format';

export default function POS() {
  const { can, settings } = useAuth();
  const cats = useFetch('/categories', { per_page: 100 }); const menu = useFetch('/menu-items', { per_page: 200 }); const tables = useFetch('/tables'); const custs = useFetch('/customers', { per_page: 200 });
  const [cat, setCat] = useState(''); const [q, setQ] = useState(''); const [cart, setCart] = useState([]); const [pick, setPick] = useState(null); const [cartOpen, setCartOpen] = useState(false);
  const [type, setType] = useState('dine_in'); const [tableId, setTableId] = useState(''); const [customerId, setCustomerId] = useState(''); const [discount, setDiscount] = useState(''); const [address, setAddress] = useState(''); const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false); const [idem, setIdem] = useState(() => crypto.randomUUID()); const [placed, setPlaced] = useState(null);
  const items = useMemo(() => (menu.data || []).filter((m) => m.is_available && (!cat || String(m.category_id) === cat) && m.name.toLowerCase().includes(q.toLowerCase())), [menu.data, cat, q]);
  const unit = (l) => toCur(+l.item.base_price + (l.variant ? +l.variant.price_delta : 0) + l.mods.reduce((s, m) => s + +m.price, 0));
  const sub = cart.reduce((s, l) => s + unit(l) * l.qty, 0); const disc = Math.min(roundCur(+discount || 0), sub);
  const tax = roundCur((sub - disc) * (+settings.tax_rate || 0) / 100); const svc = type === 'dine_in' ? roundCur((sub - disc) * (+settings.service_charge_rate || 0) / 100) : 0; const del = type === 'delivery' ? toCur(+settings.delivery_charge || 0) : 0;
  const est = sub - disc + tax + svc + del;
  const add = (l) => { setCart((c) => { const k = `${l.item.id}-${l.variant?.id}-${l.mods.map((m) => m.id).sort()}-${l.notes}`; const ex = c.find((x) => x.key === k); return ex ? c.map((x) => (x.key === k ? { ...x, qty: x.qty + 1 } : x)) : [...c, { ...l, key: k, qty: 1 }]; }); setPick(null); };
  const tap = (m) => (m.variants.length || m.modifier_groups.length ? setPick(m) : add({ item: m, variant: null, mods: [], notes: '' }));
  const place = async () => {
    setBusy(true);
    try {
      const body = { order_type: type, table_id: tableId || undefined, customer_id: customerId || undefined, delivery_address: address, notes, discount_amount: disc || undefined, idempotency_key: idem,
        items: cart.map((l) => ({ menu_item_id: l.item.id, variant_id: l.variant?.id, modifier_ids: l.mods.map((m) => m.id), quantity: l.qty, notes: l.notes })) };
      const r = await api.post('/orders', body);
      setPlaced(r.data.data.id); setCart([]); setDiscount(''); setNotes(''); setAddress(''); setTableId(''); setIdem(crypto.randomUUID()); setCartOpen(false); tables.reload(true);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (menu.loading || cats.loading) return <Spinner />; if (menu.error) return <ErrorState message={menu.error} retry={menu.reload} />;
  const needTable = type === 'dine_in' && !tableId; const needAddr = type === 'delivery' && !address.trim(); const qty = cart.reduce((s, l) => s + l.qty, 0);
  const CartPanel = (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-1 border-b border-line p-3">{['dine_in', 'takeaway', 'delivery'].map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-lg px-2 py-2 text-xs font-medium ${type === t ? 'bg-primary text-white' : 'bg-canvas text-muted'}`}>{label(t)}</button>)}</div>
      <div className="space-y-2 border-b border-line p-3">
        {type === 'dine_in' && <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}><option value="">Select table…</option>{(tables.data || []).map((t) => <option key={t.id} value={t.id} disabled={['out_of_service', 'cleaning', 'reserved'].includes(t.status)}>Table {t.number} · {label(t.status)}</option>)}</select>}
        {type === 'delivery' && <input className="input" placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />}
        <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Walk-in guest</option>{(custs.data || []).map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone}</option>)}</select></div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">{cart.length === 0 ? <Empty text="Cart is empty" /> : cart.map((l) => (
        <div key={l.key} className="rounded-lg border border-line p-2 text-sm"><div className="flex justify-between gap-2"><div><p className="font-medium">{l.item.name}{l.variant && <span className="text-muted"> · {l.variant.name}</span>}</p>{l.mods.length > 0 && <p className="text-xs text-accent">{l.mods.map((m) => m.name).join(', ')}</p>}{l.notes && <p className="text-xs italic text-muted">{l.notes}</p>}</div><p className="font-medium">{money(unit(l) * l.qty)}</p></div>
          <div className="mt-1.5 flex items-center gap-2"><button className="rounded border border-line p-1" aria-label="Decrease" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))}><Minus size={14} /></button><span className="w-6 text-center">{l.qty}</span><button className="rounded border border-line p-1" aria-label="Increase" onClick={() => setCart(cart.map((x) => (x.key === l.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x)))}><Plus size={14} /></button>
            <button className="ml-auto text-muted hover:text-red-600" aria-label="Remove" onClick={() => setCart(cart.filter((x) => x.key !== l.key))}><Trash2 size={15} /></button></div></div>))}</div>
      <div className="space-y-1.5 border-t border-line p-3 text-sm">
        {can('orders.discount') && <div className="flex items-center justify-between"><span>Discount</span><input className="input !w-28 text-right" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>}
        <input className="input" placeholder="Order notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(sub)}</span></div>
        {tax > 0 && <div className="flex justify-between text-muted"><span>Tax</span><span>{money(tax)}</span></div>}{svc > 0 && <div className="flex justify-between text-muted"><span>Service</span><span>{money(svc)}</span></div>}{del > 0 && <div className="flex justify-between text-muted"><span>Delivery</span><span>{money(del)}</span></div>}
        <div className="flex justify-between text-base font-semibold"><span>Total (final amount set by server)</span><span>{money(est)}</span></div>
        <Button className="w-full" size="lg" loading={busy} disabled={!cart.length || needTable || needAddr} onClick={place}>Place order</Button>
        {(needTable || needAddr) && cart.length > 0 && <p className="text-center text-xs text-muted">{needTable ? 'Select a table' : 'Enter delivery address'} to continue</p>}</div>
    </div>
  );
  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-2 border-b border-line bg-white p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Search menu…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCat('')} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${!cat ? 'bg-primary text-white' : 'bg-canvas text-muted'}`}>All</button>{(cats.data || []).map((c) => <button key={c.id} onClick={() => setCat(String(c.id))} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${cat === String(c.id) ? 'bg-primary text-white' : 'bg-canvas text-muted'}`}>{c.name}</button>)}</div></div>
        <div className="grid flex-1 content-start gap-3 overflow-y-auto p-3 pb-24 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] lg:pb-3">
          {items.length === 0 && <div className="col-span-full"><Empty text="No menu items found" /></div>}
          {items.map((m) => <button key={m.id} onClick={() => tap(m)} className="overflow-hidden rounded-xl border border-line bg-white text-left shadow-card transition hover:border-primary active:scale-[.98]">
            <div className="flex h-24 items-center justify-center bg-canvas">{m.image_path ? <img src={`/${m.image_path}`} alt="" className="h-full w-full object-cover" /> : <ImageOff className="text-line" />}</div>
            <div className="p-2.5"><p className="truncate text-sm font-medium">{m.name}</p><p className="text-sm font-semibold text-primary">{money(toCur(m.base_price))}</p></div></button>)}</div>
      </div>
      <aside className="hidden w-96 shrink-0 border-l border-line bg-white lg:block">{CartPanel}</aside>
      <button onClick={() => setCartOpen(true)} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-white shadow-lg lg:hidden"><ShoppingCart size={18} />{qty} · {money(est)}</button>
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Current order"><div className="-m-5 h-[70vh]">{CartPanel}</div></Modal>
      {pick && <Customize item={pick} onClose={() => setPick(null)} onAdd={add} />}
      {placed && <OrderModal id={placed} onClose={() => setPlaced(null)} />}
    </div>
  );
}
export function Customize({ item, onClose, onAdd }) {
  const [variant, setVariant] = useState(item.variants[0] || null); const [mods, setMods] = useState([]); const [notes, setNotes] = useState('');
  const toggle = (g, m) => setMods((cur) => { const inGroup = cur.filter((x) => g.modifiers.some((y) => y.id === x.id)); if (cur.some((x) => x.id === m.id)) return cur.filter((x) => x.id !== m.id); if (g.max_select === 1) return [...cur.filter((x) => !inGroup.includes(x)), m]; if (inGroup.length >= g.max_select) return cur; return [...cur, m]; });
  const bad = item.modifier_groups.find((g) => mods.filter((x) => g.modifiers.some((y) => y.id === x.id)).length < g.min_select);
  return (
    <Modal open onClose={onClose} title={item.name}><div className="space-y-4">
      {item.variants.length > 0 && <div><p className="label">Size / variant</p><div className="flex flex-wrap gap-2">{item.variants.map((v) => <button key={v.id} onClick={() => setVariant(v)} className={`rounded-lg border px-3 py-2 text-sm ${variant?.id === v.id ? 'border-primary bg-primary-soft' : 'border-line'}`}>{v.name}{+v.price_delta ? ` (+${money(toCur(v.price_delta))})` : ''}</button>)}</div></div>}
      {item.modifier_groups.map((g) => <div key={g.id}><p className="label">{g.name} <span className="font-normal">(choose {g.min_select}–{g.max_select})</span></p><div className="flex flex-wrap gap-2">{g.modifiers.map((m) => <button key={m.id} onClick={() => toggle(g, m)} className={`rounded-lg border px-3 py-2 text-sm ${mods.some((x) => x.id === m.id) ? 'border-primary bg-primary-soft' : 'border-line'}`}>{m.name}{+m.price ? ` +${money(toCur(m.price))}` : ''}</button>)}</div></div>)}
      <input className="input" placeholder="Item notes (e.g. no onions)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button className="w-full" disabled={!!bad} onClick={() => onAdd({ item, variant, mods, notes })}>{bad ? `Select ${bad.name}` : 'Add to order'}</Button></div></Modal>
  );
}
