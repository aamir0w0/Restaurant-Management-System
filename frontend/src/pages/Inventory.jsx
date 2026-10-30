import { useState } from 'react';
import { Plus, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Badge, Button, Modal, Field, Stat } from '../components/ui';
import { moneyBase as money, dt, errMsg, label } from '../utils/format'; // ingredient costs are stored in the base currency
export default function Inventory() {
  const { can } = useAuth(); const [tab, setTab] = useState('stock'); const [q, setQ] = useState('');
  const ing = useFetch('/inventory/ingredients', { q }); const mv = useFetch('/inventory/movements', { per_page: 100 });
  const [form, setForm] = useState(null); const [adj, setAdj] = useState(null); const [busy, setBusy] = useState(false); const manage = can('inventory.adjust');
  const submit = async (e, fn, ok) => { e.preventDefault(); setBusy(true); try { await fn(); toast.success(ok); setForm(null); setAdj(null); ing.reload(); mv.reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const d = ing.data;
  return (
    <>
      <PageHeader title="Inventory" subtitle="Ingredients, stock balances and the movement ledger">{manage && <Button onClick={() => setForm({ name: '', unit: 'g', cost_per_unit: 0, min_stock: 0, opening_quantity: 0 })}><Plus size={16} />New ingredient</Button>}</PageHeader>
      {d && <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Ingredients" value={d.items.length} /><Stat label="Low stock" value={d.low_count} icon={AlertTriangle} tone="accent" /><Stat label="Inventory value" value={money(d.total_value)} /></div>}
      <div className="mb-3 flex gap-2">{[['stock', 'Stock'], ['ledger', 'Movement ledger']].map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-sm ${tab === k ? 'bg-primary text-white' : 'bg-white text-muted border border-line'}`}>{t}</button>)}</div>
      <Card>
        {tab === 'stock' ? <><div className="border-b border-line p-3"><input className="input max-w-xs" placeholder="Search ingredients" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Table rows={d?.items} loading={ing.loading} error={ing.error} retry={ing.reload} empty="No ingredients" columns={[{ key: 'name', label: 'Ingredient' }, { key: 'quantity_on_hand', label: 'On hand', render: (r) => `${+r.quantity_on_hand} ${r.unit}` }, { key: 'min_stock', label: 'Minimum', render: (r) => `${+r.min_stock} ${r.unit}` },
            { key: 'cost_per_unit', label: 'Unit cost', render: (r) => money(r.cost_per_unit) }, { key: 'stock_value', label: 'Value', render: (r) => money(r.stock_value) }, { key: 'is_low', label: 'Status', render: (r) => (+r.is_low ? <Badge value="low_stock" tone="red" /> : <Badge value="ok" tone="green" />) },
            ...(manage ? [{ key: 'a', label: '', render: (r) => <div className="flex justify-end gap-1"><Button size="sm" variant="secondary" onClick={() => setAdj({ ingredient_id: r.id, name: r.name, type: 'adjustment', quantity: '', reason: '' })}><SlidersHorizontal size={14} />Adjust</Button><Button size="sm" variant="ghost" onClick={() => setForm({ ...r })}>Edit</Button></div> }] : [])]} /></>
          : <Table rows={mv.data} loading={mv.loading} error={mv.error} retry={mv.reload} empty="No movements yet" columns={[{ key: 'created_at', label: 'When', render: (r) => dt(r.created_at) }, { key: 'ingredient', label: 'Ingredient' }, { key: 'movement_type', label: 'Type', render: (r) => <Badge value={r.movement_type} tone="gray" /> },
            { key: 'quantity', label: 'Change', render: (r) => <span className={+r.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}>{+r.quantity > 0 ? '+' : ''}{+r.quantity} {r.unit}</span> }, { key: 'balance_after', label: 'Balance', render: (r) => +r.balance_after }, { key: 'reason', label: 'Reason' }, { key: 'user_name', label: 'By' }]} />}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit ingredient' : 'New ingredient'}>{form && <form className="space-y-3" onSubmit={(e) => submit(e, () => (form.id ? api.put(`/inventory/ingredients/${form.id}`, form) : api.post('/inventory/ingredients', form)), 'Ingredient saved')}>
        <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-2"><Field label="Unit"><input className="input" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field><Field label="Cost / unit"><input className="input" type="number" step="0.0001" min="0" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} /></Field><Field label="Min stock"><input className="input" type="number" step="0.0001" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field></div>
        {!form.id && <Field label="Opening quantity"><input className="input" type="number" step="0.0001" min="0" value={form.opening_quantity} onChange={(e) => setForm({ ...form, opening_quantity: e.target.value })} /></Field>}
        <div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div></form>}</Modal>
      <Modal open={!!adj} onClose={() => setAdj(null)} title={adj ? `Adjust stock · ${adj.name}` : ''}>{adj && <form className="space-y-3" onSubmit={(e) => submit(e, () => api.post('/inventory/adjustments', adj), 'Stock updated')}>
        <Field label="Type"><select className="input" value={adj.type} onChange={(e) => setAdj({ ...adj, type: e.target.value })}>{['adjustment', 'purchase', 'wastage', 'spoilage', 'return'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
        <Field label={adj.type === 'adjustment' ? 'Quantity (use negative to reduce)' : 'Quantity'}><input className="input" type="number" step="0.0001" required value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} /></Field>
        <Field label="Reason (required)"><input className="input" required value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} /></Field><div className="flex justify-end"><Button type="submit" loading={busy}>Record movement</Button></div></form>}</Modal>
    </>
  );
}
