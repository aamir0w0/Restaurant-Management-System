import { useState } from 'react';
import { Plus, Search, Pencil, Archive } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Pager, Button, Modal, Field, Confirm } from '../components/ui';
import { errMsg, money, today } from '../utils/format';

function CrudPage({ title, subtitle, endpoint, columns, fields, managePerm, noun, defaults = {}, searchable = true }) {
  const { can } = useAuth();
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [edit, setEdit] = useState(null); const [form, setForm] = useState({}); const [errs, setErrs] = useState({}); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null);
  const { data, meta, loading, error, reload } = useFetch(endpoint, { q, page, per_page: 20 });
  const canManage = can(managePerm);
  const open = (row) => { setEdit(row || {}); setForm(row ? { ...row } : { ...defaults }); setErrs({}); };
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrs({});
    try { edit.id ? await api.put(`${endpoint}/${edit.id}`, form) : await api.post(endpoint, form); toast.success(`${noun} saved`); setEdit(null); reload(); }
    catch (x) { setErrs(x.response?.data?.errors || {}); toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const archive = async () => { setBusy(true); try { await api.delete(`${endpoint}/${del.id}`); toast.success(`${noun} archived`); setDel(null); reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const cols = canManage ? [...columns, { key: '_a', label: '', render: (r) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => open(r)} aria-label="Edit"><Pencil size={14} /></Button><Button size="sm" variant="ghost" onClick={() => setDel(r)} aria-label="Archive"><Archive size={14} /></Button></div> }] : columns;
  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>{canManage && <Button onClick={() => open(null)}><Plus size={16} />New {noun}</Button>}</PageHeader>
      <Card>
        {searchable && <div className="border-b border-line p-3"><div className="relative max-w-xs"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div></div>}
        <Table columns={cols} rows={data} loading={loading} error={error} retry={reload} empty={`No ${noun}s found`} /><Pager meta={meta} onPage={setPage} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${noun}` : `New ${noun}`}>
        <form onSubmit={save} className="space-y-4">
          {fields.map((f) => <Field key={f.name} label={f.label} error={errs[f.name]}>
            {f.type === 'select' ? <select className="input" value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              : f.type === 'textarea' ? <textarea className="input" rows={3} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              : <input className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} required={f.required} value={form[f.name] ?? ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />}</Field>)}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </form>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={archive} loading={busy} danger title={`Archive ${noun}`} message="This hides the record from lists. Historical orders and reports are not affected." />
    </>
  );
}
const person = [{ name: 'name', label: 'Name', required: true }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }];
export const Categories = () => <CrudPage title="Categories" subtitle="Group your menu items" endpoint="/categories" noun="category" managePerm="menu.manage" searchable={false} defaults={{ sort_order: 0 }}
  columns={[{ key: 'name', label: 'Name' }, { key: 'sort_order', label: 'Order' }]} fields={[{ name: 'name', label: 'Name', required: true }, { name: 'sort_order', label: 'Sort order', type: 'number' }]} />;
export const Customers = () => <CrudPage title="Customers" subtitle="Profiles, contact details and spending" endpoint="/customers" noun="customer" managePerm="customers.manage"
  columns={[{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'order_count', label: 'Orders' }, { key: 'total_spent', label: 'Total spent', render: (r) => money(r.total_spent) }]}
  fields={[...person, { name: 'address', label: 'Address' }, { name: 'notes', label: 'Notes', type: 'textarea' }]} />;
export const Suppliers = () => <CrudPage title="Suppliers" subtitle="Supplier directory (purchase orders are not implemented yet)" endpoint="/suppliers" noun="supplier" managePerm="suppliers.manage"
  columns={[{ key: 'name', label: 'Supplier' }, { key: 'contact_name', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }]}
  fields={[{ name: 'name', label: 'Supplier name', required: true }, { name: 'contact_name', label: 'Contact person' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'address', label: 'Address' }]} />;
export const Expenses = () => <CrudPage title="Expenses" subtitle="Operating expenses used in reports" endpoint="/expenses" noun="expense" managePerm="expenses.manage" defaults={{ expense_date: today(), payment_method: 'cash' }}
  columns={[{ key: 'expense_date', label: 'Date' }, { key: 'category', label: 'Category' }, { key: 'vendor', label: 'Vendor' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) }, { key: 'payment_method', label: 'Method' }]}
  fields={[{ name: 'expense_date', label: 'Date', type: 'date', required: true }, { name: 'category', label: 'Category', required: true }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'vendor', label: 'Vendor' }, { name: 'payment_method', label: 'Payment method' }, { name: 'description', label: 'Description' }]} />;
