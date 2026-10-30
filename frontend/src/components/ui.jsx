import { useEffect } from 'react';
import { X, Loader2, Inbox, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { label } from '../utils/format';
const cx = (...a) => a.filter(Boolean).join(' ');
export function Button({ variant = 'primary', size = 'md', className, loading, children, ...p }) {
  const v = { primary: 'bg-primary text-white hover:bg-primary-hover', accent: 'bg-accent text-white hover:opacity-90', secondary: 'bg-white border border-line text-ink hover:bg-canvas', danger: 'bg-red-600 text-white hover:bg-red-700', ghost: 'text-muted hover:bg-canvas' }[variant];
  return <button type="button" {...p} disabled={p.disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm', v, className)}>{loading && <Loader2 size={14} className="animate-spin" />}{children}</button>;
}
export const Card = ({ className, children }) => <div className={cx('rounded-xl border border-line bg-white shadow-card', className)}>{children}</div>;
const tones = { green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-sky-50 text-sky-700', gray: 'bg-gray-100 text-gray-600', orange: 'bg-accent-soft text-accent' };
const map = { pending: 'amber', accepted: 'blue', preparing: 'orange', ready: 'green', served: 'green', completed: 'gray', cancelled: 'red', unpaid: 'red', partially_paid: 'amber', paid: 'green', partially_refunded: 'amber', refunded: 'gray', available: 'green', occupied: 'orange', reserved: 'blue', cleaning: 'amber', out_of_service: 'red' };
export const Badge = ({ value, tone }) => <span className={cx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone || map[value] || 'gray'])}>{label(value)}</span>;
export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div><div className="flex flex-wrap items-center gap-2">{children}</div></div>
);
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => { if (!open) return; const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-canvas"><X size={18} /></button></div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
export function Confirm({ open, title, message, onConfirm, onClose, danger, loading }) {
  return <Modal open={open} onClose={onClose} title={title}><p className="mb-5 flex gap-2 text-sm text-muted"><AlertTriangle size={18} className="shrink-0 text-accent" />{message}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>Confirm</Button></div></Modal>;
}
export function Field({ label: l, error, children }) { return <div><label className="label">{l}</label>{children}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>; }
export const Spinner = () => <div className="flex justify-center py-16 text-muted"><Loader2 className="animate-spin" /></div>;
export const Empty = ({ text = 'Nothing here yet' }) => <div className="flex flex-col items-center gap-2 py-14 text-sm text-muted"><Inbox size={28} />{text}</div>;
export const ErrorState = ({ message, retry }) => <div className="flex flex-col items-center gap-3 py-14 text-sm text-red-600"><AlertTriangle />{message}{retry && <Button variant="secondary" size="sm" onClick={retry}>Retry</Button>}</div>;
export function Table({ columns, rows, loading, error, retry, empty, onRow }) {
  if (loading) return <Spinner />; if (error) return <ErrorState message={error} retry={retry} />; if (!rows?.length) return <Empty text={empty} />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-line bg-canvas/60"><tr>{columns.map((c) => <th key={c.key} className="th">{c.label}</th>)}</tr></thead>
    <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'cursor-pointer hover:bg-canvas/60' : ''}>{columns.map((c) => <td key={c.key} className="td">{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody></table></div>;
}
export function Pager({ meta, onPage }) {
  if (!meta || meta.total <= meta.per_page) return null; const pages = Math.ceil(meta.total / meta.per_page);
  return <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted"><span>{meta.total} records</span><div className="flex items-center gap-2"><Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous"><ChevronLeft size={14} /></Button><span>{meta.page} / {pages}</span><Button variant="secondary" size="sm" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)} aria-label="Next"><ChevronRight size={14} /></Button></div></div>;
}
const chip = { primary: 'bg-primary-soft text-primary', teal: 'bg-primary-soft text-primary', accent: 'bg-accent-soft text-accent', amber: 'bg-amber-50 text-amber-600', blue: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', green: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600' };
export function Stat({ label: l, value, icon: Icon, tone = 'primary', delta, sub }) {
  const up = delta >= 0;
  return (
    <Card className="p-4"><div className="flex items-start justify-between"><div className="min-w-0"><p className="text-sm text-muted">{l}</p><p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p></div>
      {Icon && <span className={cx('rounded-xl p-2.5', chip[tone] || chip.primary)}><Icon size={18} /></span>}</div>
      {(delta !== undefined && delta !== null) ? <p className="mt-2 flex items-center gap-1 text-xs text-muted">vs previous period <span className={cx('ml-auto font-semibold', up ? 'text-emerald-600' : 'text-rose-600')}>{up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span></p> : sub ? <p className="mt-2 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}
