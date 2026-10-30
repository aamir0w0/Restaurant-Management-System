import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Badge, Button, Modal, Field, Spinner, ErrorState, Empty } from '../components/ui';
import { OrderModal } from './Orders';
import { errMsg, label } from '../utils/format';
export default function Tables() {
  const { can } = useAuth(); const { data, loading, error, reload } = useFetch('/tables', {}, { poll: 10000 });
  const [form, setForm] = useState(null); const [sel, setSel] = useState(null); const [order, setOrder] = useState(null); const [busy, setBusy] = useState(false); const [target, setTarget] = useState('');
  const save = async (e) => { e.preventDefault(); setBusy(true); try { form.id ? await api.put(`/tables/${form.id}`, form) : await api.post('/tables', form); toast.success('Table saved'); setForm(null); reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const setStatus = async (s) => { try { await api.put(`/tables/${sel.id}/status`, { status: s }); toast.success('Updated'); setSel(null); reload(); } catch (x) { toast.error(errMsg(x)); } };
  const transfer = async () => { try { await api.post(`/orders/${sel.open_order_id}/transfer`, { table_id: target }); toast.success('Order transferred'); setSel(null); setTarget(''); reload(); } catch (x) { toast.error(errMsg(x)); } };
  if (loading && !data) return <Spinner />; if (error && !data) return <ErrorState message={error} retry={reload} />;
  const sections = [...new Set(data.map((t) => t.section || 'Main'))];
  return (
    <>
      <PageHeader title="Tables" subtitle="Live floor status">{can('tables.manage') && <Button onClick={() => setForm({ number: '', section: '', capacity: 4 })}><Plus size={16} />New table</Button>}</PageHeader>
      {data.length === 0 && <Empty text="No tables yet" />}
      {sections.map((s) => <div key={s} className="mb-6"><h2 className="mb-2 text-sm font-semibold text-muted">{s}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {data.filter((t) => (t.section || 'Main') === s).map((t) => <button key={t.id} onClick={() => setSel(t)} className="text-left"><Card className="p-3 transition hover:border-primary"><div className="flex items-center justify-between"><span className="text-lg font-semibold">{t.number}</span><Badge value={t.status} /></div><p className="mt-1 text-xs text-muted">{t.capacity} seats</p>{t.open_order_number && <p className="mt-1 text-xs text-accent">{t.open_order_number}</p>}</Card></button>)}</div></div>)}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `Table ${sel.number}` : ''}>{sel && <div className="space-y-4">
        {sel.open_order_id && <div className="space-y-2"><Button variant="secondary" onClick={() => { setOrder(sel.open_order_id); setSel(null); }}>Open order {sel.open_order_number}</Button>
          {can('orders.update') && <div className="flex gap-2"><select className="input" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Transfer to…</option>{data.filter((t) => t.status === 'available').map((t) => <option key={t.id} value={t.id}>Table {t.number}</option>)}</select><Button disabled={!target} onClick={transfer}>Transfer</Button></div>}</div>}
        {can('tables.manage') && <><div className="flex flex-wrap gap-2">{['available', 'reserved', 'cleaning', 'out_of_service'].map((s) => <Button key={s} size="sm" variant="secondary" disabled={sel.status === s} onClick={() => setStatus(s)}>{label(s)}</Button>)}</div><Button variant="ghost" size="sm" onClick={() => { setForm(sel); setSel(null); }}>Edit table details</Button></>}</div>}</Modal>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit table' : 'New table'}>{form && <form onSubmit={save} className="space-y-4"><Field label="Table number"><input className="input" required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field><Field label="Section"><input className="input" value={form.section || ''} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field><Field label="Capacity"><input className="input" type="number" min="1" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field><div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div></form>}</Modal>
      {order && <OrderModal id={order} onClose={() => setOrder(null)} onChanged={reload} />}
    </>
  );
}
