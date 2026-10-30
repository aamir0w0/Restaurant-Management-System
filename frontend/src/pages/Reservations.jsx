import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Badge, Button, Modal, Field } from '../components/ui';
import { today, errMsg } from '../utils/format';
export default function Reservations() {
  const [date, setDate] = useState(today()); const { data, loading, error, reload } = useFetch('/reservations', { date }); const tables = useFetch('/tables');
  const [form, setForm] = useState(null); const [busy, setBusy] = useState(false);
  const blank = { customer_name: '', phone: '', party_size: 2, reservation_date: date, start_time: '19:00', duration_minutes: 90, table_id: '', notes: '' };
  const save = async (e) => { e.preventDefault(); setBusy(true); try { const b = { ...form }; if (!b.table_id) delete b.table_id; await api.post('/reservations', b); toast.success('Reservation created'); setForm(null); reload(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); } };
  const move = async (r, status) => { try { await api.put(`/reservations/${r.id}/status`, { status }); reload(); } catch (x) { toast.error(errMsg(x)); } };
  const acts = { booked: [['checked_in', 'Check in'], ['no_show', 'No-show'], ['cancelled', 'Cancel']], checked_in: [['completed', 'Complete']] };
  return (
    <>
      <PageHeader title="Reservations" subtitle="Bookings are checked against table capacity and overlapping times"><input type="date" className="input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} /><Button onClick={() => setForm({ ...blank, reservation_date: date })}><Plus size={16} />New reservation</Button></PageHeader>
      <Card><Table rows={data} loading={loading} error={error} retry={reload} empty="No reservations for this date" columns={[
        { key: 'start_time', label: 'Time', render: (r) => <span className="font-semibold">{r.start_time.slice(0, 5)}</span> }, { key: 'customer_name', label: 'Guest', render: (r) => <div>{r.customer_name}<div className="text-xs text-muted">{r.phone}</div></div> }, { key: 'party_size', label: 'Party' },
        { key: 'table_number', label: 'Table', render: (r) => r.table_number || 'Unassigned' }, { key: 'duration_minutes', label: 'Duration', render: (r) => `${r.duration_minutes} min` }, { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} tone={{ booked: 'blue', checked_in: 'green', completed: 'gray', cancelled: 'red', no_show: 'amber' }[r.status]} /> },
        { key: 'a', label: '', render: (r) => <div className="flex justify-end gap-1">{(acts[r.status] || []).map(([s, l]) => <Button key={s} size="sm" variant="secondary" onClick={() => move(r, s)}>{l}</Button>)}</div> }]} /></Card>
      <Modal open={!!form} onClose={() => setForm(null)} title="New reservation">{form && <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><Field label="Guest name"><input className="input" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field><Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Date"><input className="input" type="date" required value={form.reservation_date} onChange={(e) => setForm({ ...form, reservation_date: e.target.value })} /></Field><Field label="Start time"><input className="input" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></Field>
          <Field label="Party size"><input className="input" type="number" min="1" required value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} /></Field><Field label="Duration (min)"><input className="input" type="number" min="15" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></Field></div>
        <Field label="Table"><select className="input" value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })}><option value="">Assign later</option>{(tables.data || []).map((t) => <option key={t.id} value={t.id}>Table {t.number} · {t.capacity} seats {t.section ? `· ${t.section}` : ''}</option>)}</select></Field>
        <Field label="Special requests"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="flex justify-end"><Button type="submit" loading={busy}>Create reservation</Button></div></form>}</Modal>
    </>
  );
}
