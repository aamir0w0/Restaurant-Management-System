import { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../services/api';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Button, Stat } from '../components/ui';
import { money, today, label } from '../utils/format';
const TYPES = ['sales-by-day', 'sales-by-item', 'sales-by-category', 'sales-by-cashier', 'sales-by-type', 'payments-by-method', 'refunds', 'cancelled-orders', 'discounts', 'expenses', 'stock-movements', 'wastage', 'low-stock'];
const isMoney = (k) => /total|sales|revenue|amount|collected|discount|tax|service|cost|gross/i.test(k) && !/orders|payments|qty/i.test(k);
export default function Reports() {
  const monthStart = today().slice(0, 8) + '01'; const [from, setFrom] = useState(monthStart); const [to, setTo] = useState(today()); const [type, setType] = useState('sales-by-day');
  const rep = useFetch(`/reports/${type}`, { from, to }); const pnl = useFetch('/reports/profit-estimate', { from, to });
  const rows = rep.data || []; const cols = rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: label(k), render: (r) => (isMoney(k) && r[k] !== null && !isNaN(r[k]) ? money(r[k]) : r[k]) })) : [];
  const csv = () => window.open(`${api.defaults.baseURL}/reports/${type}?from=${from}&to=${to}&format=csv`, '_blank');
  const p = pnl.data;
  return (
    <>
      <PageHeader title="Reports" subtitle="Calculated from live database records"><input type="date" className="input !w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /><span className="text-muted">to</span><input type="date" className="input !w-auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></PageHeader>
      {p && <><div className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Gross sales" value={money(p.gross_sales)} /><Stat label="Net sales (after discounts & refunds)" value={money(p.net_sales)} /><Stat label="Payments collected" value={money(p.collected_payments)} /><Stat label="Operating expenses" value={money(p.operating_expenses)} />
        <Stat label="Ingredient cost of sales" value={money(p.ingredient_cost_of_sales)} /><Stat label="Estimated operating profit" value={money(p.estimated_operating_profit)} tone="accent" /><Stat label="Taxes" value={money(p.taxes)} /><Stat label="Service charges" value={money(p.service_charges)} /></div><p className="mb-4 text-xs text-muted">{p.note}</p></>}
      <Card><div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3"><select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{label(t.replace(/-/g, '_'))}</option>)}</select><Button variant="secondary" size="sm" onClick={csv}><Download size={14} />Export CSV</Button></div>
        <Table rows={rows} columns={cols} loading={rep.loading} error={rep.error} retry={rep.reload} empty="No data for this range" /></Card>
    </>
  );
}
