import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Badge, Button, Modal, Field, Spinner } from '../components/ui';
import { moneyBase, dt, errMsg, currencyConfig } from '../utils/format';
const tone = { draft: 'gray', approved: 'blue', partially_received: 'amber', received: 'green', cancelled: 'red' };
export default function Purchases() {
  const { can } = useAuth(); const list = useFetch('/purchases'); const sup = useFetch('/suppliers', { per_page: 200 }); const ings = useFetch('/inventory/ingredients');
  const [form, setForm] = useState(null); const [sel, setSel] = useState(null); const [busy, setBusy] = useState(false);
  const create = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/purchases', form); toast.success('Purchase order created'); setForm(null); list.reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  return (
    <>
      <PageHeader title="Purchasing" subtitle={`Purchase orders and goods receiving. Costs are in ${currencyConfig().base} (base currency).`}><Button onClick={() => setForm({ supplier_id: '', notes: '', items: [{ ingredient_id: '', quantity: 1, unit_cost: 0 }] })}><Plus size={16} />New purchase order</Button></PageHeader>
      <Card><Table rows={list.data} loading={list.loading} error={list.error} retry={list.reload} empty="No purchase orders yet" onRow={(r) => setSel(r.id)} columns={[{ key: 'po_number', label: 'PO', render: (r) => <span className="font-medium">{r.po_number}</span> }, { key: 'supplier', label: 'Supplier' }, { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) }, { key: 'total', label: 'Total', render: (r) => moneyBase(r.total) }, { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} tone={tone[r.status]} /> }]} /></Card>
      <Modal wide open={!!form} onClose={() => setForm(null)} title="New purchase order">{form && <form onSubmit={create} className="space-y-3">
        <Field label="Supplier"><select className="input" required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}><option value="">Select…</option>{(sup.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        {form.items.map((l, i) => <div key={i} className="flex gap-2"><select className="input" required value={l.ingredient_id} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, ingredient_id: e.target.value } : x)) })}><option value="">Ingredient…</option>{(ings.data?.items || []).map((g) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}</select>
          <input className="input !w-28" type="number" step="0.0001" min="0.0001" placeholder="Qty" value={l.quantity} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)) })} /><input className="input !w-28" type="number" step="0.0001" min="0" placeholder="Unit cost" value={l.unit_cost} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)) })} />
          <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button></div>)}
        <Button variant="secondary" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { ingredient_id: '', quantity: 1, unit_cost: 0 }] })}>Add line</Button>
        <div className="flex justify-end"><Button type="submit" loading={busy}>Create draft</Button></div></form>}</Modal>
      {sel && <Detail id={sel} can={can} onClose={() => setSel(null)} onChanged={list.reload} />}
    </>
  );
}
function Detail({ id, can, onClose, onChanged }) {
  const [rev, setRev] = useState(0); const { data: p, loading } = useFetch(`/purchases/${id}`, { rev }); const [rec, setRec] = useState({}); const [busy, setBusy] = useState(false);
  const act = async (fn, ok) => { setBusy(true); try { await fn(); toast.success(ok); setRec({}); setRev((x) => x + 1); onChanged(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const canReceive = p && ['approved', 'partially_received'].includes(p.status) && can('purchases.manage');
  const receive = () => act(() => api.post(`/purchases/${id}/receive`, { items: p.items.map((i) => ({ po_item_id: i.id, accepted: rec[i.id]?.a || 0, rejected: rec[i.id]?.r || 0 })).filter((x) => +x.accepted || +x.rejected) }), 'Goods received');
  return (
    <Modal wide open onClose={onClose} title={p ? p.po_number : 'Purchase order'}>{loading || !p ? <Spinner /> : (<div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><p>{p.supplier} · <Badge value={p.status} tone={tone[p.status]} /> · Total {moneyBase(p.total)}</p>
        <div className="flex gap-2">{p.status === 'draft' && can('purchases.approve') && <Button size="sm" loading={busy} onClick={() => act(() => api.post(`/purchases/${id}/approve`), 'Approved')}>Approve</Button>}{['draft', 'approved'].includes(p.status) && can('purchases.manage') && <Button size="sm" variant="danger" loading={busy} onClick={() => act(() => api.post(`/purchases/${id}/cancel`), 'Cancelled')}>Cancel</Button>}</div></div>
      <table className="w-full"><thead><tr className="text-left text-xs text-muted"><th className="py-1">Ingredient</th><th>Ordered</th><th>Received</th><th>Rejected</th><th>Unit cost</th>{canReceive && <th>Receive now</th>}</tr></thead>
        <tbody>{p.items.map((i) => <tr key={i.id} className="border-t border-line"><td className="py-2">{i.ingredient}</td><td>{+i.quantity_ordered} {i.unit}</td><td>{+i.quantity_received}</td><td>{+i.quantity_rejected}</td><td>{moneyBase(i.unit_cost)}</td>
          {canReceive && <td className="flex gap-1 py-1"><input className="input !w-20 !py-1" type="number" step="0.0001" min="0" placeholder="OK" value={rec[i.id]?.a || ''} onChange={(e) => setRec({ ...rec, [i.id]: { ...rec[i.id], a: e.target.value } })} /><input className="input !w-20 !py-1" type="number" step="0.0001" min="0" placeholder="Bad" value={rec[i.id]?.r || ''} onChange={(e) => setRec({ ...rec, [i.id]: { ...rec[i.id], r: e.target.value } })} /></td>}</tr>)}</tbody></table>
      {canReceive && <div className="flex justify-end"><Button loading={busy} onClick={receive}>Receive goods into stock</Button></div>}
      <p className="text-xs text-muted">Receiving increases inventory once per receipt. Payments to suppliers are tracked under Expenses (not here) so purchases are never counted twice.</p></div>)}</Modal>
  );
}
