import { useEffect } from 'react';
import { BellRing, Globe, Store, ArrowRight, X } from 'lucide-react';
/** Centre-screen square alert shown when a new order arrives. */
export default function OrderAlert({ alert, remaining, onView, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 20000); return () => clearTimeout(t); }, [alert.id]); // auto-dismiss after 20s
  const online = /ONLINE/i.test(alert.message);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" style={{ animation: 'fadeIn .2s ease-out' }} role="alertdialog" aria-live="assertive" aria-label="New order">
      <div className="relative flex aspect-square w-[min(88vw,23rem)] flex-col items-center justify-between overflow-hidden rounded-3xl bg-white p-6 text-center shadow-pop" style={{ animation: 'popIn .55s cubic-bezier(.2,.9,.3,1.2) both' }}>
        <button onClick={onClose} aria-label="Dismiss" className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-canvas"><X size={18} /></button>
        <div className="relative mt-2 flex h-20 w-20 items-center justify-center"><span className="absolute inset-0 rounded-full bg-primary/30" style={{ animation: 'ringPulse 1.6s ease-out infinite' }} /><span className="absolute inset-0 rounded-full bg-primary/20" style={{ animation: 'ringPulse 1.6s ease-out .5s infinite' }} />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg" style={{ animation: 'bellShake 1s ease-in-out .4s 2' }}><BellRing size={30} /></span></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">New order</p><p className="mt-1 text-2xl font-bold tracking-tight">{alert.number || 'Incoming order'}</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${online ? 'bg-sky-50 text-sky-700' : 'bg-primary-soft text-primary'}`}>{online ? <Globe size={13} /> : <Store size={13} />}{online ? 'Website order' : 'Restaurant order'}</span></div>
        <div className="w-full space-y-2"><button onClick={onView} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-hover">View order <ArrowRight size={16} /></button>
          <p className="text-[11px] text-muted">{remaining > 0 ? `+${remaining} more waiting` : 'Dismisses automatically'}</p></div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/15"><div className="h-full bg-primary" style={{ animation: 'shrink 20s linear forwards' }} /></div>
      </div>
    </div>
  );
}
