import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ShoppingBag, Receipt, UserPlus, Banknote, Hourglass, Wallet, Undo2, AlertTriangle, ImageOff } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useFetch } from '../components/useFetch';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Stat, Card, Badge, Spinner, ErrorState, Empty } from '../components/ui';
import { money, today, label } from '../utils/format';
const PM = { card_online: 'Online card', cash: 'Cash', card_terminal: 'Card terminal', other: 'Other' };
import { themeHex } from '../utils/themes';
const pct = (cur, prev) => (+prev > 0 ? ((+cur - +prev) / +prev) * 100 : null);
export default function Dashboard() {
  const { user } = useAuth(); const [from, setFrom] = useState(today()); const [to, setTo] = useState(today());
  const { data, loading, error, reload } = useFetch('/dashboard', { from, to }); const s = data?.summary; const P = themeHex('primary'); const A = themeHex('accent');
  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} subtitle="Here is what is happening with your restaurant.">
        <input type="date" className="input !w-auto rounded-xl" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><span className="text-muted">to</span><input type="date" className="input !w-auto rounded-xl" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
      </PageHeader>
      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} retry={reload} /> : (<div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total sales" value={money(s.sales)} icon={TrendingUp} tone="teal" delta={pct(s.sales, s.prev.sales)} /><Stat label="Orders" value={s.orders} icon={ShoppingBag} tone="green" delta={pct(s.orders, s.prev.orders)} />
          <Stat label="Average order value" value={money(s.avg_order)} icon={Receipt} tone="violet" delta={pct(s.avg_order, s.prev.avg_order)} /><Stat label="New customers" value={s.new_customers} icon={UserPlus} tone="amber" sub="Added in this period" /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[['Collected', money(s.collected), Banknote, 'text-emerald-600'], ['Outstanding', money(s.outstanding), Hourglass, 'text-amber-600'], ['Expenses', money(s.expenses), Wallet, 'text-sky-600'], ['Refunds', money(s.refunds), Undo2, 'text-rose-600'], ['In progress', s.pending, ShoppingBag, 'text-primary'], ['Low-stock items', s.low_stock, AlertTriangle, 'text-accent']].map(([l, v, I, c]) => (
            <Card key={l} className="flex items-center gap-3 p-3"><I size={18} className={c} /><div className="min-w-0"><p className="text-xs text-muted">{l}</p><p className="truncate text-sm font-semibold">{v}</p></div></Card>))}</div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2"><h3 className="mb-4 font-semibold">Sales overview</h3>{data.sales_over_time.length ? <div className="h-72"><ResponsiveContainer><AreaChart data={data.sales_over_time.map((d) => ({ ...d, sales: +d.sales }))}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={P} stopOpacity={0.35} /><stop offset="100%" stopColor={P} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#e8edf1" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} /><Tooltip formatter={(v) => money(v)} /><Area type="monotone" dataKey="sales" stroke={P} strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer></div> : <Empty text="No sales in this range" />}</Card>
          <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Top selling items</h3><Link to="/reports" className="text-sm text-primary">View all</Link></div>
            {data.top_items.length ? <ul className="space-y-3">{data.top_items.map((i) => <li key={i.item_name} className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas">{i.image_path ? <img src={`/${i.image_path}`} alt="" className="h-full w-full object-cover" /> : <ImageOff size={15} className="text-muted" />}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{i.item_name}</span><span className="text-sm text-muted">{i.qty}</span><span className="w-24 text-right text-sm font-semibold">{money(i.revenue)}</span></li>)}</ul> : <Empty />}</Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Active orders</h3><Link to="/kitchen" className="text-sm text-primary">View all</Link></div>
            {data.active_orders.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.active_orders.map((o) => <div key={o.id} className="rounded-xl border border-line p-3"><p className="font-semibold">#{o.order_number.slice(-4)}</p><p className="text-xs text-muted">{o.table_number ? `Table ${o.table_number}` : label(o.order_type)}</p><p className="text-xs text-muted">{o.item_count} items</p><div className="mt-2"><Badge value={o.status} /></div></div>)}</div> : <Empty text="No active orders" />}</Card>
          <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Recent transactions</h3><Link to="/orders" className="text-sm text-primary">View all</Link></div>
            {data.recent_orders.length ? <ul className="space-y-2.5">{data.recent_orders.slice(0, 6).map((o) => <li key={o.id} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate font-medium">{o.order_number}</span><span className="text-muted">{money(o.total)}</span><Badge value={o.payment_status} /></li>)}</ul> : <Empty text="No orders yet" />}</Card>
        </div>
        <Card className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Payments received</h3><Link to="/payments" className="text-sm text-primary">View records</Link></div>
          {data.payments_by_method.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.payments_by_method.map((p) => { const tot = data.payments_by_method.reduce((a, x) => a + +x.collected, 0); const w = tot ? (+p.collected / tot) * 100 : 0; return <div key={p.method}><div className="flex items-baseline justify-between"><span className="text-sm text-muted">{PM[p.method] || label(p.method)} ({p.payments})</span><span className="font-semibold">{money(p.collected)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} /></div></div>; })}</div> : <Empty text="No payments in this range" />}</Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5"><h3 className="mb-3 font-semibold">Orders by status</h3>{data.by_status.length ? <div className="h-56"><ResponsiveContainer><PieChart><Pie data={data.by_status.map((d) => ({ name: label(d.status), value: +d.count }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>{data.by_status.map((_, i) => <Cell key={i} fill={[P, A, '#5B8DEF', '#8B5CF6', '#10B981', '#F43F5E', '#94A3B8'][i % 7]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <Empty text="No orders" />}</Card>
          <Card className="p-5"><h3 className="mb-3 font-semibold">Sales by order type</h3>{data.by_type.length ? <div className="h-56"><ResponsiveContainer><BarChart data={data.by_type.map((d) => ({ ...d, sales: +d.sales, order_type: label(d.order_type) }))}><XAxis dataKey="order_type" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={55} /><Tooltip formatter={(v) => money(v)} /><Bar dataKey="sales" fill={A} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty />}</Card>
        </div></div>)}
    </>
  );
}
