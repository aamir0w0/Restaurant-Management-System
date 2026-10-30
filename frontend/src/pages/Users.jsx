import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Badge, Button, Modal, Field } from '../components/ui';
import { dt, errMsg } from '../utils/format';
export default function Users() {
  const { can, user: me } = useAuth(); const users = useFetch('/users'); const roles = useFetch('/roles'); const [tab, setTab] = useState('users');
  const [form, setForm] = useState(null); const [busy, setBusy] = useState(false); const [roleSel, setRoleSel] = useState(null); const [perms, setPerms] = useState([]);
  const save = async (e) => { e.preventDefault(); setBusy(true); try { form.id ? await api.put(`/users/${form.id}`, { name: form.name, role_id: form.role_id, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) }) : await api.post('/users', form); toast.success('User saved'); setForm(null); users.reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const savePerms = async () => { setBusy(true); try { await api.put(`/roles/${roleSel.id}/permissions`, { permissions: perms }); toast.success('Permissions updated'); roles.reload(); setRoleSel(null); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const R = roles.data?.roles || [];
  return (
    <>
      <PageHeader title="Users & Roles" subtitle="Accounts and configurable permissions">{tab === 'users' && <Button onClick={() => setForm({ name: '', email: '', role_id: '', password: '', is_active: 1 })}><Plus size={16} />New user</Button>}</PageHeader>
      <div className="mb-3 flex gap-2">{[['users', 'Users'], ['roles', 'Roles & permissions']].map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-4 py-1.5 text-sm ${tab === k ? 'bg-primary text-white' : 'border border-line bg-white text-muted'}`}>{t}</button>)}</div>
      <Card>{tab === 'users' ? <Table rows={users.data} loading={users.loading} error={users.error} retry={users.reload} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'is_active', label: 'Status', render: (u) => <Badge value={+u.is_active ? 'active' : 'inactive'} tone={+u.is_active ? 'green' : 'gray'} /> }, { key: 'last_login_at', label: 'Last login', render: (u) => dt(u.last_login_at) || '—' },
        { key: 'a', label: '', render: (u) => <Button size="sm" variant="ghost" onClick={() => setForm({ ...u, password: '' })}>Edit</Button> }]} />
        : <Table rows={R} loading={roles.loading} error={roles.error} columns={[{ key: 'label', label: 'Role' }, { key: 'permissions', label: 'Permissions', render: (r) => r.name === 'super_admin' ? 'All (fixed)' : `${r.permissions.length} granted` }, { key: 'a', label: '', render: (r) => r.name !== 'super_admin' && can('roles.manage') && <Button size="sm" variant="secondary" onClick={() => { setRoleSel(r); setPerms(r.permissions); }}>Edit permissions</Button> }]} />}</Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit user' : 'New user'}>{form && <form onSubmit={save} className="space-y-3"><Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required disabled={!!form.id} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role"><select className="input" required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: +e.target.value })}><option value="">Select…</option>{R.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
        <Field label={form.id ? 'Reset password (leave blank to keep)' : 'Password (min 10 characters)'}><input className="input" type="password" minLength={10} required={!form.id} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></Field>
        {form.id && form.id !== me.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!+form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />Account active</label>}
        <div className="flex justify-end"><Button type="submit" loading={busy}>Save</Button></div></form>}</Modal>
      <Modal wide open={!!roleSel} onClose={() => setRoleSel(null)} title={roleSel ? `Permissions · ${roleSel.label}` : ''}>{roleSel && <><div className="grid gap-2 sm:grid-cols-2">{(roles.data.permissions || []).map((p) => <label key={p.code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perms.includes(p.code)} onChange={(e) => setPerms(e.target.checked ? [...perms, p.code] : perms.filter((x) => x !== p.code))} />{p.label}</label>)}</div><div className="mt-4 flex justify-end"><Button loading={busy} onClick={savePerms}>Save permissions</Button></div></>}</Modal>
    </>
  );
}
