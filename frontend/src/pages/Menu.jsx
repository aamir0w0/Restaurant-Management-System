import { useState } from 'react';
import { Plus, Search, Pencil, Archive, Trash2, ImageOff } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Pager, Badge, Button, Modal, Field, Confirm } from '../components/ui';
import { moneyBase, money, toCur, errMsg } from '../utils/format';
const blank = { name: '', category_id: '', description: '', base_price: '', prep_minutes: 10, is_available: 1, variants: [], modifier_group_ids: [] };
export default function Menu() {
  const { can } = useAuth(); const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [page, setPage] = useState(1);
  const { data, meta, loading, error, reload } = useFetch('/menu-items', { q, category_id: cat, page, per_page: 20 }); const cats = useFetch('/categories', { per_page: 100 }); const groups = useFetch('/modifier-groups');
  const [form, setForm] = useState(null); const [recipe, setRecipe] = useState([]); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null); const [gform, setGform] = useState(null); const ings = useFetch('/inventory/ingredients', {});
  const canManage = can('menu.manage'); const canRecipe = can('inventory.adjust');
  const open = async (m) => {
    if (!m) { setForm({ ...blank }); setRecipe([]); return; }
    setForm({ ...m, modifier_group_ids: m.modifier_groups.map((g) => g.id), variants: m.variants.map((v) => ({ ...v })) });
    if (can('inventory.view')) api.get(`/menu-items/${m.id}/recipe`).then((r) => setRecipe(r.data.data.items.map((x) => ({ ingredient_id: x.ingredient_id, quantity: x.quantity })))).catch(() => setRecipe([]));
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...form }; delete body.modifier_groups; delete body.category_name;
      const r = form.id ? await api.put(`/menu-items/${form.id}`, body) : await api.post('/menu-items', body);
      const id = r.data.data.id;
      if (canRecipe && (form.id || recipe.length)) await api.put(`/menu-items/${id}/recipe`, { items: recipe.filter((x) => x.ingredient_id && +x.quantity > 0) });
      if (form._file) { const fd = new FormData(); fd.append('image', form._file); await api.post(`/menu-items/${id}/image`, fd); }
      toast.success('Menu item saved'); setForm(null); reload();
    } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const archive = async () => { try { await api.delete(`/menu-items/${del.id}`); toast.success('Archived'); setDel(null); reload(); } catch (x) { toast.error(errMsg(x)); } };
  const saveGroup = async (e) => { e.preventDefault(); try { gform.id ? await api.put(`/modifier-groups/${gform.id}`, gform) : await api.post('/modifier-groups', gform); toast.success('Modifier group saved'); setGform(null); groups.reload(); } catch (x) { toast.error(errMsg(x)); } };
  return (
    <>
      <PageHeader title="Menu" subtitle="Items, variants, modifiers and recipes">{canManage && <><Button variant="secondary" onClick={() => setGform({ name: '', min_select: 0, max_select: 3, modifiers: [{ name: '', price: 0 }] })}>Modifier groups</Button><Button onClick={() => open(null)}><Plus size={16} />New item</Button></>}</PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted" /><input className="input pl-9" placeholder="Search items" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select className="input !w-auto" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">All categories</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <Table rows={data} loading={loading} error={error} retry={reload} empty="No menu items" columns={[
          { key: 'img', label: '', render: (m) => <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-canvas">{m.image_path ? <img src={`/${m.image_path}`} alt="" className="h-full w-full object-cover" /> : <ImageOff size={16} className="text-line" />}</div> },
          { key: 'name', label: 'Item' }, { key: 'category_name', label: 'Category' }, { key: 'base_price', label: 'Base price', render: (m) => moneyBase(m.base_price) }, { key: 'sell', label: 'Selling price', render: (m) => money(toCur(m.base_price)) }, { key: 'variants', label: 'Variants', render: (m) => m.variants.length || '—' },
          { key: 'is_available', label: 'Status', render: (m) => <Badge value={m.is_available ? 'available' : 'out_of_service'} tone={m.is_available ? 'green' : 'red'} /> },
          ...(canManage ? [{ key: 'a', label: '', render: (m) => <div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => open(m)} aria-label="Edit"><Pencil size={14} /></Button><Button size="sm" variant="ghost" onClick={() => setDel(m)} aria-label="Archive"><Archive size={14} /></Button></div> }] : [])]} />
        <Pager meta={meta} onPage={setPage} />
      </Card>
      <Modal wide open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit menu item' : 'New menu item'}>{form && <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Category"><select className="input" required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Select…</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Base price (entered in base currency)"><input className="input" type="number" step="0.01" min="0" required disabled={form.id && !can('menu.price')} value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></Field>
          <Field label="Prep time (min)"><input className="input" type="number" min="1" value={form.prep_minutes} onChange={(e) => setForm({ ...form, prep_minutes: e.target.value })} /></Field></div>
        <Field label="Description"><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!+form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked ? 1 : 0 })} />Available for sale</label><input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setForm({ ...form, _file: e.target.files[0] })} /></div>
        <div><p className="label">Variants (e.g. sizes)</p>{form.variants.map((v, i) => <div key={i} className="mb-2 flex gap-2"><input className="input" placeholder="Name" value={v.name} onChange={(e) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><input className="input !w-32" type="number" step="0.01" placeholder="+ price" value={v.price_delta} onChange={(e) => setForm({ ...form, variants: form.variants.map((x, j) => (j === i ? { ...x, price_delta: e.target.value } : x)) })} /><Button variant="ghost" size="sm" onClick={() => setForm({ ...form, variants: form.variants.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button></div>)}
          <Button variant="secondary" size="sm" onClick={() => setForm({ ...form, variants: [...form.variants, { name: '', price_delta: 0 }] })}>Add variant</Button></div>
        <div><p className="label">Modifier groups</p><div className="flex flex-wrap gap-2">{(groups.data || []).map((g) => <label key={g.id} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm"><input type="checkbox" checked={form.modifier_group_ids.includes(g.id)} onChange={(e) => setForm({ ...form, modifier_group_ids: e.target.checked ? [...form.modifier_group_ids, g.id] : form.modifier_group_ids.filter((x) => x !== g.id) })} />{g.name}</label>)}{!groups.data?.length && <span className="text-sm text-muted">No modifier groups yet</span>}</div></div>
        {canRecipe && <div><p className="label">Recipe (ingredients deducted when the order enters “preparing”)</p>{recipe.map((r, i) => <div key={i} className="mb-2 flex gap-2"><select className="input" value={r.ingredient_id} onChange={(e) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, ingredient_id: e.target.value } : x)))}><option value="">Ingredient…</option>{(ings.data?.items || []).map((g) => <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>)}</select><input className="input !w-28" type="number" step="0.0001" min="0" value={r.quantity} onChange={(e) => setRecipe(recipe.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /><Button variant="ghost" size="sm" onClick={() => setRecipe(recipe.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></div>)}
          <Button variant="secondary" size="sm" onClick={() => setRecipe([...recipe, { ingredient_id: '', quantity: 1 }])}>Add ingredient</Button></div>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" loading={busy}>Save item</Button></div></form>}</Modal>
      <Modal open={!!gform} onClose={() => setGform(null)} title="Modifier group">{gform && <form onSubmit={saveGroup} className="space-y-3">
        <div className="mb-2 flex flex-wrap gap-2">{(groups.data || []).map((g) => <Button key={g.id} size="sm" variant="secondary" onClick={() => setGform({ ...g })}>{g.name}</Button>)}</div>
        <Field label="Group name"><input className="input" required value={gform.name} onChange={(e) => setGform({ ...gform, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label="Min choices"><input className="input" type="number" min="0" value={gform.min_select} onChange={(e) => setGform({ ...gform, min_select: e.target.value })} /></Field><Field label="Max choices"><input className="input" type="number" min="1" value={gform.max_select} onChange={(e) => setGform({ ...gform, max_select: e.target.value })} /></Field></div>
        {gform.modifiers.map((m, i) => <div key={i} className="flex gap-2"><input className="input" placeholder="Modifier" value={m.name} onChange={(e) => setGform({ ...gform, modifiers: gform.modifiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><input className="input !w-28" type="number" step="0.01" min="0" value={m.price} onChange={(e) => setGform({ ...gform, modifiers: gform.modifiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} /></div>)}
        <Button variant="secondary" size="sm" onClick={() => setGform({ ...gform, modifiers: [...gform.modifiers, { name: '', price: 0 }] })}>Add modifier</Button><div className="flex justify-end"><Button type="submit">Save group</Button></div></form>}</Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onConfirm={archive} danger title="Archive item" message="The item disappears from the POS. Past orders keep their original name and price." />
    </>
  );
}
