import { useState } from 'react';
import { Globe, Banknote, CreditCard, Wallet, Undo2 } from 'lucide-react';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Pager, Badge, Stat } from '../components/ui';
import { money, dt, today, label } from '../utils/format';
const META = { card_online: ['Online card payments', Globe, 'blue'], cash: ['Cash payments', Banknote, 'green'], card_terminal: ['Card terminal', CreditCard, 'violet'], other: ['Other', Wallet, 'amber'] };
export default function Payments() {
  const [from, setFrom] = useState(today().slice(0, 8) + '01'); const [to, setTo] = useState(today()); const [method, setMethod] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useFetch('/payments', { from, to, method, q, page, per_page: 25 });
  const sum = meta?.summary || []; const total = sum.reduce((s, x) => s + +x.total, 0); const count = sum.reduce((s, x) => s + +x.payments, 0);
  const cards = Object.keys(META).map((k) => ({ k, row: sum.find((x) => x.method === k) })).concat(sum.filter((x) => !META[x.method]).map((x) => ({ k: x.method, row: x })));
  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment received, split by online card, cash and other methods">
        <input type="date" className="input !w-auto rounded-xl" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /><span className="text-muted">to</span><input type="date" className="input !w-auto rounded-xl" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></PageHeader>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={`All payments (${count})`} value={money(total)} icon={Wallet} tone="teal" />
        {cards.map(({ k, row }) => { const m = META[k] || [label(k), Wallet, 'amber']; return <Stat key={k} label={`${m[0]} (${row?.payments || 0})`} value={money(row?.total || 0)} icon={m[1]} tone={m[2]} sub={total > 0 ? `${(((row?.total || 0) / total) * 100).toFixed(0)}% of collections` : '—'} />; })}
        <Stat label="Refunds issued" value={money(meta?.refunds || 0)} icon={Undo2} tone="rose" /></div>
      <Card><div className="flex flex-wrap gap-2 border-b border-line p-3"><select className="input !w-auto" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}><option value="">All methods</option>{['cash', 'card_online', 'card_terminal', 'other'].map((m) => <option key={m} value={m}>{label(m)}</option>)}</select><input className="input !w-56" placeholder="Search order number" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Table rows={data} loading={loading} error={error} retry={reload} empty="No payments in this range" columns={[{ key: 'created_at', label: 'When', render: (r) => dt(r.created_at) }, { key: 'order_number', label: 'Order', render: (r) => <span className="flex items-center gap-2 font-medium">{r.order_number}{r.source === 'online' && <Badge value="online" tone="blue" />}</span> },
          { key: 'method', label: 'Method', render: (r) => <Badge value={r.method} tone={{ card_online: 'blue', cash: 'green', card_terminal: 'orange' }[r.method] || 'gray'} /> }, { key: 'amount', label: 'Amount', render: (r) => <span className="font-semibold">{money(r.amount, r.currency)}</span> }, { key: 'reference', label: 'Reference', render: (r) => r.reference || '—' }, { key: 'received_by', label: 'Received by' }]} />
        <Pager meta={meta} onPage={setPage} /></Card>
    </>
  );
}
