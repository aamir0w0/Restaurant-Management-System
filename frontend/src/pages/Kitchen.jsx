import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { Badge, Button, Spinner, ErrorState, Empty, Modal } from '../components/ui';
import { errMsg, label } from '../utils/format';
const COLS = [['pending', 'New', 'accepted', 'Accept'], ['accepted', 'Accepted', 'preparing', 'Start preparing'], ['preparing', 'Preparing', 'ready', 'Mark ready'], ['ready', 'Ready', 'served', 'Hand over']];
const mmss = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);
export default function Kitchen() {
  const { can } = useAuth(); const [poll, setPoll] = useState(5000); const [busy, setBusy] = useState(null);
  const { data, loading, error, reload, fetchedAt } = useFetch('/kitchen/orders', {}, { poll: poll || undefined });
  // Smooth per-second timers: every order gets a fixed start time; the screen re-draws twice a second, independent of server polling.
  const [now, setNow] = useState(Date.now()); const starts = useRef({});
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const secs = (o) => { const est = fetchedAt - o.elapsed_seconds * 1000; const cur = starts.current[o.id]; if (cur === undefined || Math.abs(cur - est) > 2000) starts.current[o.id] = est; return Math.max(0, Math.floor((now - starts.current[o.id]) / 1000)); };
  const canAct = can('kitchen.update') || can('orders.update');
  const [cancel, setCancel] = useState(null); const [why, setWhy] = useState('');
  const doCancel = async () => { setBusy(cancel.id); try { await api.put(`/orders/${cancel.id}/status`, { status: 'cancelled', note: why.trim() }); setCancel(null); setWhy(''); reload(true); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };
  const move = async (o, to) => { setBusy(o.id); try { await api.put(`/orders/${o.id}/status`, { status: to }); reload(true); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };
  if (loading && !data) return <Spinner />; if (error && !data) return <ErrorState message={error} retry={reload} />;
  const cancelled = data.filter((o) => o.status === 'cancelled');
  return (
    <div className="flex h-full flex-col bg-ink/[.03]">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2"><h1 className="font-semibold">Kitchen display</h1>
        <label className="flex items-center gap-2 text-xs text-muted">Refresh<select className="input !w-auto !py-1" value={poll} onChange={(e) => setPoll(+e.target.value)}><option value={3000}>3s</option><option value={5000}>5s</option><option value={15000}>15s</option><option value={0}>Off</option></select></label></div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 md:grid-cols-2 xl:grid-cols-5">
        {COLS.map(([st, title, next, action]) => { const list = data.filter((o) => o.status === st); return (
          <section key={st} className="flex min-h-[200px] flex-col rounded-xl bg-canvas p-2"><h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">{title}<span className="rounded-full bg-white px-2 text-xs text-muted">{list.length}</span></h2>
            <div className="space-y-2 overflow-y-auto">{list.length === 0 && <Empty text="No orders" />}
              {list.map((o) => (<article key={o.id} className={`rounded-xl border bg-white p-3 shadow-card ${secs(o) > 900 && st !== 'ready' ? 'border-red-300' : 'border-line'}`}>
                <div className="mb-2 flex items-center justify-between"><div><p className="text-base font-bold">{o.order_number.slice(-4)} <span className="text-xs font-normal text-muted">{label(o.order_type)}{o.table_number ? ` · T${o.table_number}` : ''}</span></p></div><span className={`text-sm font-semibold tabular-nums ${secs(o) > 900 ? 'text-red-600' : 'text-muted'}`}>{mmss(secs(o))}</span></div>
                <ul className="space-y-1.5 text-sm">{o.items.map((i) => <li key={i.id}><span className="font-semibold">{i.quantity}×</span> {i.item_name}{i.variant_name && <span className="text-muted"> ({i.variant_name})</span>}
                  {i.modifiers.length > 0 && <div className="pl-5 text-xs text-accent">{i.modifiers.join(', ')}</div>}{i.notes && <div className="pl-5 text-xs italic text-muted">“{i.notes}”</div>}</li>)}</ul>
                {o.notes && <p className="mt-2 rounded bg-accent-soft px-2 py-1 text-xs">{o.notes}</p>}
                {canAct && <Button className="mt-3 w-full" size="lg" loading={busy === o.id} onClick={() => move(o, next)}>{action}</Button>}
                {canAct && <button onClick={() => { setCancel(o); setWhy(''); }} className="mt-2 w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">Cancel order</button>}</article>))}</div></section>); })}
        <section className="flex min-h-[200px] flex-col rounded-xl bg-canvas p-2"><h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">Cancelled<span className="rounded-full bg-white px-2 text-xs text-muted">{cancelled.length}</span></h2>
          <div className="space-y-2 overflow-y-auto">{cancelled.length === 0 && <Empty text="None in the last 10 min" />}{cancelled.map((o) => (<article key={o.id} className="rounded-xl border border-red-200 bg-red-50/60 p-3"><p className="font-bold">{o.order_number.slice(-4)} <span className="text-xs font-normal text-muted">{label(o.order_type)}{o.table_number ? ` · T${o.table_number}` : ''}</span></p><ul className="mt-1 text-sm text-muted line-through">{o.items.map((i) => <li key={i.id}>{i.quantity}× {i.item_name}</li>)}</ul>{o.cancel_reason && <p className="mt-2 text-xs text-red-700">Reason: {o.cancel_reason}</p>}</article>))}</div></section>
      </div>
      <Modal open={!!cancel} onClose={() => setCancel(null)} title={cancel ? `Cancel order ${cancel.order_number.slice(-4)}?` : ''}>{cancel && (<div className="space-y-4">
        <p className="text-sm text-muted">The order is removed from the kitchen board and the table is freed. A reason is required and is saved in the audit log.</p>
        {['preparing', 'ready'].includes(cancel.status) && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">Food is already in progress. Ingredients used are not returned to stock; record wastage in Inventory if it was prepared.</p>}
        {['paid', 'partially_paid', 'partially_refunded'].includes(cancel.payment_status) && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This order has a payment. A manager must refund it first (Orders → open the order → Refund), then it can be cancelled.</p>}
        <div className="flex flex-wrap gap-2">{['Customer cancelled', 'Wrong or duplicate order', 'Item not available'].map((r) => <button key={r} type="button" onClick={() => setWhy(r)} className={`rounded-full border px-3 py-1 text-xs ${why === r ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}>{r}</button>)}</div>
        <input className="input" placeholder="Reason for cancelling" value={why} onChange={(e) => setWhy(e.target.value)} autoFocus />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCancel(null)}>Keep order</Button><Button variant="danger" loading={busy === cancel.id} disabled={!why.trim()} onClick={doCancel}>Cancel order</Button></div></div>)}</Modal>
    </div>
  );
}