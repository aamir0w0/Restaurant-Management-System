import { money, dt, label } from '../utils/format';
const rowsOf = (o) => [['Subtotal', +o.subtotal], ['Discount', -o.discount_total, +o.discount_total > 0], ['Tax', +o.tax_total, +o.tax_total > 0], ['Service charge', +o.service_charge, +o.service_charge > 0], ['Delivery', +o.delivery_charge, +o.delivery_charge > 0]].filter((r) => r[2] === undefined || r[2]);
/** Three printable layouts. theme: classic | modern | minimal (chosen by the Super Admin in Settings). */
export default function Receipt({ o, settings, theme }) {
  const t = theme || settings.receipt_theme || 'classic'; const cur = o.currency; const m = (v) => money(v, cur);
  const rate = +o.exchange_rate !== 1 && settings.base_currency ? `1 ${settings.base_currency} = ${+o.exchange_rate} ${cur}` : null;
  const meta = <>#{o.order_number} · {dt(o.created_at)}<br />{label(o.order_type)}{o.table_number ? ` · Table ${o.table_number}` : ''} · {o.cashier_name}</>;
  const items = o.items.map((i) => <div key={i.id} className="mb-1.5"><div className="flex justify-between gap-2"><span>{i.quantity} × {i.item_name}{i.variant_name ? ` (${i.variant_name})` : ''}</span><span>{m(i.line_total)}</span></div>{i.modifiers.map((x, k) => <div key={k} className="pl-4 text-[11px] opacity-70">+ {x.name}</div>)}</div>);
  const totals = <>{rowsOf(o).map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{m(v)}</span></div>)}</>;
  const paid = <>{o.payments.map((p) => <div key={p.id} className="flex justify-between"><span>Paid ({label(p.method)})</span><span>{m(p.amount)}</span></div>)}{+o.refunded_total > 0 && <div className="flex justify-between"><span>Refunded</span><span>{m(o.refunded_total)}</span></div>}<div className="flex justify-between font-semibold"><span>Balance due</span><span>{m(o.balance_due)}</span></div></>;
  const foot = <>{rate && <p className="mt-2 text-center text-[10px] opacity-70">Prices converted at {rate}</p>}<p className="mt-2 text-center">{settings.receipt_footer}</p></>;
  const head = <><div className="text-center text-sm font-bold">{settings.restaurant_name}</div>{settings.address && <div className="text-center">{settings.address}</div>}{settings.phone && <div className="text-center">{settings.phone}</div>}</>;
  if (t === 'modern') return (
    <div id="receipt" className="mx-auto w-72 overflow-hidden rounded-xl bg-white text-xs text-ink shadow-card">
      <div className="bg-primary px-4 py-4 text-center text-white"><div className="text-base font-bold">{settings.restaurant_name}</div><div className="text-[11px] opacity-80">{settings.address} {settings.phone}</div></div>
      <div className="space-y-2 p-4"><p className="text-[11px] text-muted">{meta}</p><div className="border-y border-line py-2">{items}</div><div className="space-y-0.5 text-muted">{totals}</div>
        <div className="flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2 text-sm font-bold text-primary"><span>TOTAL</span><span>{m(o.total)}</span></div><div className="space-y-0.5">{paid}</div>{foot}</div></div>);
  if (t === 'minimal') return (
    <div id="receipt" className="mx-auto w-72 bg-white p-3 text-[11px] leading-5 text-black">
      <div className="mb-2 text-center font-semibold tracking-wide">{settings.restaurant_name}</div><p className="mb-2 text-center text-[10px]">{meta}</p>{items}<div className="mt-2 border-t border-black pt-1">{totals}<div className="flex justify-between text-sm font-semibold"><span>Total</span><span>{m(o.total)}</span></div>{paid}</div>{foot}</div>);
  return (
    <div id="receipt" className="mx-auto w-72 bg-white p-2 font-mono text-xs text-black">{head}<hr className="my-2 border-dashed border-black" /><div>{meta}</div><hr className="my-2 border-dashed border-black" />{items}<hr className="my-2 border-dashed border-black" />{totals}
      <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{m(o.total)}</span></div>{paid}<hr className="my-2 border-dashed border-black" />{foot}</div>);
}
