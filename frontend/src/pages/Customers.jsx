import { useState } from 'react';
import { Plus, Search, Gift, ShoppingBag, Wallet, Globe } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Pager, Badge, Button, Modal, Field, Stat, Spinner } from '../components/ui';
import { money, dt, errMsg } from '../utils/format';
export default function Customers() {
  const { can } = useAuth(); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [sel, setSel] = useState(null); const [form, setForm] = useState(null); const [busy, setBusy] = useState(false);
  const { data, meta, loading, error, reload } = useFetch('/customers', { q, page, per_page: 20 }); const manage = can('customers.manage');
  const save = async (e) => { e.preventDefault(); setBusy(true); try { const { id, name, phone, email, address, notes } = form; const body = { name, phone, email, address, notes }; id ? await api.put(`/customers/${id}`, body) : await api.post('/customers', body); toast.success('Customer saved'); setForm(null); reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Customers" subtitle="CRM: profiles, order history, spending and loyalty. Website orders are added here automatically.">{manage && <Button onClick={() => setForm({ name: '', phone: '', email: '', address: '', notes: '' })}><Plus size={16} />New customer</Button>}</PageHeader>
      <Card><div className="border-b border-line p-3"><div className="relative max-w-xs"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Search name, phone, email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div></div>
        <Table rows={data} loading={loading} error={error} retry={reload} empty="No customers yet" onRow={(r) => setSel(r.id)} columns={[{ key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' },
          { key: 'source', label: 'Source', render: (r) => <Badge value={r.source} tone={r.source === 'online' ? 'blue' : 'gray'} /> }, { key: 'order_count', label: 'Orders' }, { key: 'total_spent', label: 'Total spent', render: (r) => money(r.total_spent) }, { key: 'loyalty_points', label: 'Points' }]} />
        <Pager meta={meta} onPage={setPage} /></Card>
      {sel && <Profile id={sel} manage={manage} onClose={() => setSel(null)} onEdit={(c) => { setForm(c); setSel(null); }} onChanged={reload} />}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit customer' : 'New customer'}>{form && <form onSubmit={save} className="space-y-3">
        {[['name', 'Name', true], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address']].map(([k, l, r]) => <Field key={k} label={l}><input className="input" required={r} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>)}
        <Field label="Notes"><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div></form>}</Modal>
    </>
  );
}
function Profile({ id, manage, onClose, onEdit, onChanged }) {
  const [rev, setRev] = useState(0); const { data: c, loading } = useFetch(`/customers/${id}/profile`, { rev }); const [pts, setPts] = useState(''); const [why, setWhy] = useState('');
  const adjust = async () => { try { await api.post(`/customers/${id}/loyalty`, { points: pts, reason: why }); toast.success('Points updated'); setPts(''); setWhy(''); setRev((x) => x + 1); onChanged(); } catch (x) { toast.error(errMsg(x)); } };
  return (
    <Modal open onClose={onClose} wide title={c ? c.name : 'Customer'}>{loading || !c ? <Spinner /> : (<div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><div className="space-y-0.5 text-muted"><p>{c.phone} {c.email && `· ${c.email}`}</p>{c.address && <p>{c.address}</p>}<p className="flex items-center gap-1"><Globe size={13} />Source: {c.source} · since {dt(c.created_at)}</p></div>{manage && <Button size="sm" variant="secondary" onClick={() => onEdit(c)}>Edit details</Button>}</div>
      <div className="grid grid-cols-3 gap-3"><Stat label="Orders" value={c.order_count} icon={ShoppingBag} /><Stat label="Total spent" value={money(c.total_spent)} icon={Wallet} tone="green" /><Stat label="Loyalty points" value={c.loyalty_points} icon={Gift} tone="amber" /></div>
      <div><p className="mb-2 font-semibold">Recent orders</p><Table rows={c.orders} empty="No orders yet" columns={[{ key: 'order_number', label: 'Order' }, { key: 'created_at', label: 'Date', render: (r) => dt(r.created_at) }, { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }, { key: 'total', label: 'Total', render: (r) => money(r.total, r.currency) }]} /></div>
      <div><p className="mb-2 font-semibold">Loyalty ledger</p>{c.loyalty.length ? c.loyalty.map((l, i) => <p key={i} className="text-sm text-muted">{dt(l.created_at)} · <span className={l.points < 0 ? 'text-rose-600' : 'text-emerald-600'}>{l.points > 0 ? '+' : ''}{l.points}</span> · {l.reason}</p>) : <p className="text-sm text-muted">Points are earned automatically when an order is completed.</p>}
        {manage && <div className="mt-3 flex flex-wrap gap-2"><input className="input !w-28" type="number" placeholder="± points" value={pts} onChange={(e) => setPts(e.target.value)} /><input className="input flex-1" placeholder="Reason (required)" value={why} onChange={(e) => setWhy(e.target.value)} /><Button variant="secondary" disabled={!pts || !why} onClick={adjust}>Adjust</Button></div>}</div>
    </div>)}</Modal>
  );
}
