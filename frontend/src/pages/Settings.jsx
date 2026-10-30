import { useState, useEffect } from 'react';
import { Check, Palette } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Receipt from '../components/Receipt';
import { PageHeader, Card, Field, Button } from '../components/ui';
import { errMsg, setCurrencyConfig, money } from '../utils/format';
import { THEMES, RECEIPT_THEMES, applyTheme } from '../utils/themes';
const GROUPS = [
  ['Restaurant', [['restaurant_name', 'Restaurant name'], ['address', 'Address'], ['phone', 'Phone'], ['email', 'Email'], ['receipt_footer', 'Receipt footer text']]],
  ['Currency & pricing', [['base_currency', 'Base currency (menu prices & ingredient costs are entered in this)'], ['currency', 'Selling currency (what customers pay, e.g. PKR)'], ['exchange_rate', 'Exchange rate: 1 base unit = ? selling units', 'number'], ['tax_rate', 'Tax rate (%)', 'number'], ['service_charge_rate', 'Service charge – dine-in (%)', 'number'], ['delivery_charge', 'Delivery charge (base currency)', 'number']]],
  ['Online ordering', [['online_min_order', 'Minimum online order (base currency)', 'number']]],
  ['Website content', [['store_tagline', 'Website headline'], ['store_about', 'About text shown on the website'], ['store_hours', 'Opening hours (e.g. Mon-Sun 11:00-23:00)']]],
  ['WhatsApp thank-you message', [['whatsapp_country_code', 'Default country code for local numbers (92 = Pakistan)']]],
  ['Payments & loyalty', [['payment_methods', 'Staff payment methods (comma list, must include cash)'], ['loyalty_points_per_unit', 'Loyalty points per 1 base-currency unit spent', 'number']]],
];
const FLAGS = [['online_ordering_enabled', 'Accept orders on the website'], ['online_delivery_enabled', 'Offer delivery on the website'], ['allow_negative_stock', 'Allow sales when ingredient stock is insufficient']];
export default function Settings() {
  const { settings, setSettings, can, user } = useAuth(); const [f, setF] = useState(settings); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState({}); const ro = !can('settings.manage'); const sa = user.role === 'super_admin';
  useEffect(() => setF(settings), [settings]);
  useEffect(() => () => applyTheme(settings.ui_theme), [settings.ui_theme]); // revert unsaved preview when leaving
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrs({});
    try { const body = { ...f }; if (!sa) { delete body.ui_theme; delete body.receipt_theme; } const r = await api.put('/settings', body); setSettings(r.data.data); setCurrencyConfig(r.data.data); applyTheme(r.data.data.ui_theme); toast.success('Settings saved'); }
    catch (x) { setErrs(x.response?.data?.errors || {}); toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const rate = f.currency !== f.base_currency ? +f.exchange_rate || 1 : 1; const dec = ['PKR', 'JPY', 'KRW', 'VND'].includes(f.currency) ? 0 : 2; const conv = (b) => Math.round(b * rate * 10 ** dec) / 10 ** dec;
  const sample = { order_number: 'ORD-DEMO-0001', created_at: new Date().toISOString(), order_type: 'dine_in', table_number: 'T1', cashier_name: user.name, currency: f.currency, exchange_rate: rate,
    items: [{ id: 1, quantity: 2, item_name: 'Cheese Burger', variant_name: null, line_total: conv(9.5) * 2, modifiers: [{ name: 'Extra Cheese' }] }, { id: 2, quantity: 1, item_name: 'Cappuccino', variant_name: 'Large', line_total: conv(5), modifiers: [] }],
    subtotal: conv(9.5) * 2 + conv(5), discount_total: 0, tax_total: 0, service_charge: 0, delivery_charge: 0, total: conv(9.5) * 2 + conv(5), payments: [], refunded_total: 0, balance_due: conv(9.5) * 2 + conv(5) };
  return (
    <>
      <PageHeader title="Settings" subtitle="Restaurant configuration (validated on the server)" />
      <form onSubmit={save} className="grid max-w-6xl gap-4 xl:grid-cols-2">
        {GROUPS.map(([title, fields]) => <Card key={title} className="space-y-4 p-5"><h3 className="font-semibold">{title}</h3>
          {title === 'Currency & pricing' && <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">1 {f.base_currency} = {rate} {f.currency} · a {money(8.5, f.base_currency)} item sells for {money(conv(8.5), f.currency)}. Every unit price is converted once and rounded, so line items always add up to the total.</p>}
          {fields.map(([k, l, t]) => <Field key={k} label={l} error={errs[k]}><input className="input" type={t || 'text'} step="any" disabled={ro} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: k.endsWith('currency') ? e.target.value.toUpperCase() : e.target.value })} /></Field>)}
          {title === 'WhatsApp thank-you message' && <>{[['whatsapp_enabled', 'Send a WhatsApp thank-you when an online order is placed'], ['whatsapp_notify_pos', 'Also send it for restaurant (POS) orders that have a customer phone']].map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ro} checked={f[k] === '1'} onChange={(e) => setF({ ...f, [k]: e.target.checked ? '1' : '0' })} />{l}</label>)}<p className="text-xs text-muted">Needs a Meta WhatsApp Business account, an approved template and <code>WHATSAPP_TOKEN</code> / <code>WHATSAPP_PHONE_ID</code> in <code>backend/.env</code> (see README). If sending fails the order is still saved and the error appears in the Audit Log.</p></>}
          {title === 'Online ordering' && FLAGS.slice(0, 2).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ro} checked={f[k] === '1'} onChange={(e) => setF({ ...f, [k]: e.target.checked ? '1' : '0' })} />{l}</label>)}
          {title === 'Payments & loyalty' && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={ro} checked={f.allow_negative_stock === '1'} onChange={(e) => setF({ ...f, allow_negative_stock: e.target.checked ? '1' : '0' })} />{FLAGS[2][1]}</label>
            <p className="text-xs text-muted">Online card payments (Stripe) switch on when <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> are set in <code>backend/.env</code>; secrets are never stored in the database.</p></>}
        </Card>)}
        <Card className="space-y-4 p-5 xl:col-span-2"><h3 className="flex items-center gap-2 font-semibold"><Palette size={18} />Appearance & receipt</h3>
          {!sa ? <p className="text-sm text-muted">Only a Super Admin can change the colour theme and receipt layout.</p> : (<>
            <div><p className="label">Software theme (applies to staff app and website)</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Object.entries(THEMES).map(([k, t]) => (
              <button type="button" key={k} onClick={() => { setF({ ...f, ui_theme: k }); applyTheme(k); }} className={`rounded-xl border p-3 text-left transition ${f.ui_theme === k ? 'border-primary ring-2 ring-primary/30' : 'border-line hover:border-primary/50'}`}>
                <div className="mb-2 flex h-10 overflow-hidden rounded-lg"><span className="flex-1" style={{ background: `rgb(${t.sidebar})` }} /><span className="flex-1" style={{ background: `rgb(${t.primary})` }} /><span className="flex-1" style={{ background: `rgb(${t.accent})` }} /></div>
                <p className="flex items-center justify-between text-sm font-medium">{t.label}{f.ui_theme === k && <Check size={15} className="text-primary" />}</p></button>))}</div></div>
            <div className="grid gap-5 md:grid-cols-2"><div><p className="label">Receipt layout</p><div className="space-y-2">{Object.entries(RECEIPT_THEMES).map(([k, l]) => <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${f.receipt_theme === k ? 'border-primary bg-primary-soft' : 'border-line'}`}><input type="radio" name="rt" checked={f.receipt_theme === k} onChange={() => setF({ ...f, receipt_theme: k })} />{l}</label>)}</div></div>
              <div className="rounded-xl bg-canvas p-3"><Receipt o={sample} settings={f} theme={f.receipt_theme} /></div></div></>)}
        </Card>
        {!ro && <div className="xl:col-span-2"><Button type="submit" size="lg" loading={busy}>Save settings</Button></div>}
      </form>
    </>
  );
}
