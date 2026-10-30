import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Receipt from '../components/Receipt';
import { Search, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Pager, Badge, Modal, Button, Field, Spinner } from '../components/ui';
import { money, dt, errMsg, label } from '../utils/format';
const NEXT = { pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'served', served: 'completed' };

export function OrderModal({ id, onClose, onChanged }) {
  const { can, settings } = useAuth(); const [rev, setRev] = useState(0); const { data: o, loading, reload } = useFetch(id ? `/orders/${id}` : '/orders/0', { rev });
  const [pay, setPay] = useState({ method: 'cash', amount: '', tendered: '', reference: '' }); const [busy, setBusy] = useState(false); const [reason, setReason] = useState(''); const [refund, setRefund] = useState('');
  const run = async (fn, ok) => { setBusy(true); try { await fn(); toast.success(ok); setRev((x) => x + 1); onChanged?.(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  if (!id) return null;
  const methods = (settings.payment_methods || 'cash').split(',');
  const net = o ? +o.paid_total - +o.refunded_total : 0;
  return (
    <Modal open onClose={onClose} title={o ? `Order ${o.order_number}` : 'Order'} wide>
      {loading || !o ? <Spinner /> : (<div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge value={o.status} /><Badge value={o.payment_status} /><Badge value={o.order_type} tone="gray" />{o.table_number && <Badge value={`Table ${o.table_number}`} tone="blue" />}</div>
          {o.customer_name && <p>Customer: {o.customer_name} {o.customer_phone}</p>}{o.delivery_address && <p>Deliver to: {o.delivery_address}</p>}{o.notes && <p className="rounded bg-accent-soft px-2 py-1">Note: {o.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {NEXT[o.status] && can('orders.update') && <Button size="sm" loading={busy} onClick={() => run(() => api.put(`/orders/${id}/status`, { status: NEXT[o.status] }), 'Status updated')}>Mark {NEXT[o.status]}</Button>}
            <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer size={14} />Print receipt</Button></div>
          {['pending', 'accepted', 'preparing', 'ready'].includes(o.status) && (can('orders.cancel') || can('orders.update')) && <div className="flex gap-2"><input className="input" placeholder="Cancellation reason" value={reason} onChange={(e) => setReason(e.target.value)} /><Button size="sm" variant="danger" loading={busy} disabled={!reason} onClick={() => run(() => api.put(`/orders/${id}/status`, { status: 'cancelled', note: reason }), 'Order cancelled')}>Cancel order</Button></div>}
          {o.status !== 'cancelled' && +o.balance_due > 0 && can('payments.create') && (
            <div className="space-y-2 rounded-lg border border-line p-3"><p className="font-medium">Take payment · due {money(o.balance_due)}</p>
              <div className="grid grid-cols-2 gap-2"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{methods.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select>
                <input className="input" type="number" step="0.01" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
                {pay.method === 'cash' ? <input className="input" type="number" step="0.01" placeholder="Cash tendered" value={pay.tendered} onChange={(e) => setPay({ ...pay, tendered: e.target.value })} /> : <input className="input" placeholder="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />}
                <Button loading={busy} disabled={!pay.amount} onClick={() => run(() => api.post(`/orders/${id}/payments`, { ...pay, idempotency_key: crypto.randomUUID() }).then(() => setPay({ ...pay, amount: '', tendered: '' })), 'Payment recorded')}>Record</Button></div>
              <button className="text-xs text-primary" onClick={() => setPay({ ...pay, amount: o.balance_due, tendered: pay.method === 'cash' ? o.balance_due : '' })}>Fill balance</button></div>)}
          {net > 0 && can('payments.refund') && <div className="flex gap-2"><input className="input" type="number" step="0.01" placeholder={`Refund (max ${money(net)})`} value={refund} onChange={(e) => setRefund(e.target.value)} /><Button size="sm" variant="secondary" loading={busy} disabled={!refund || !reason} onClick={() => run(() => api.post(`/orders/${id}/refunds`, { amount: refund, reason }), 'Refund recorded')}>Refund</Button></div>}
          {net > 0 && can('payments.refund') && <p className="text-xs text-muted">Refunds use the reason field above.</p>}
          <div><p className="mb-1 font-medium">History</p>{o.history.map((h, i) => <p key={i} className="text-xs text-muted">{dt(h.created_at)} — {label(h.to_status)} {h.by_name ? `by ${h.by_name}` : ''} {h.note ? `(${h.note})` : ''}</p>)}</div>
        </div>
        <div className="rounded-lg border border-line bg-canvas/50 p-3"><Receipt o={o} settings={settings} /></div>
      </div>)}
    </Modal>
  );
}
export default function Orders() {
  const [sp] = useSearchParams(); const [f, setF] = useState({ q: sp.get('q') || '', status: '', payment_status: '', order_type: '', source: '', from: '', to: '' });
  useEffect(() => { setF((x) => ({ ...x, q: sp.get('q') || '' })); }, [sp]); const [page, setPage] = useState(1); const [sel, setSel] = useState(null);
  const { data, meta, loading, error, reload } = useFetch('/orders', { ...f, page });
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  const sels = (k, opts) => <select className="input !w-auto" value={f[k]} onChange={set(k)}><option value="">{label(k)}: all</option>{opts.map((o) => <option key={o} value={o}>{label(o)}</option>)}</select>;
  return (
    <>
      <PageHeader title="Orders" subtitle="Search, filter and manage orders" />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Order no, customer, phone" value={f.q} onChange={set('q')} /></div>
          {sels('status', ['pending', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled'])}{sels('payment_status', ['unpaid', 'partially_paid', 'paid', 'partially_refunded', 'refunded'])}{sels('order_type', ['dine_in', 'takeaway', 'delivery'])}{sels('source', ['pos', 'online'])}
          <input type="date" className="input !w-auto" value={f.from} onChange={set('from')} aria-label="From" /><input type="date" className="input !w-auto" value={f.to} onChange={set('to')} aria-label="To" /></div>
        <Table rows={data} loading={loading} error={error} retry={reload} empty="No orders match" onRow={(r) => setSel(r.id)} columns={[
          { key: 'order_number', label: 'Order', render: (r) => <span className="flex items-center gap-2 font-medium">{r.order_number}{r.source === 'online' && <Badge value="online" tone="blue" />}</span> }, { key: 'created_at', label: 'Created', render: (r) => dt(r.created_at) }, { key: 'order_type', label: 'Type', render: (r) => label(r.order_type) }, { key: 'table_number', label: 'Table' }, { key: 'customer_name', label: 'Customer' },
          { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> }, { key: 'payment_status', label: 'Payment', render: (r) => <Badge value={r.payment_status} /> }, { key: 'total', label: 'Total', render: (r) => money(r.total) }]} />
        <Pager meta={meta} onPage={setPage} />
      </Card>
      {sel && <OrderModal id={sel} onClose={() => setSel(null)} onChanged={reload} />}
    </>
  );
}