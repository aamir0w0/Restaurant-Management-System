import { useState } from 'react';
import { UtensilsCrossed, ShieldCheck, ChefHat, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field } from '../components/ui';
import { errMsg } from '../utils/format';
export default function Login() {
  const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await login(email, password); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" /><div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3 text-xl font-semibold"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary"><UtensilsCrossed /></span>Restaurant Manager</div>
        <div className="relative"><h2 className="max-w-md text-4xl font-semibold leading-tight">Run every table, order and plate from one place.</h2>
          <ul className="mt-8 space-y-4 text-white/80">{[[ChefHat, 'Live kitchen display and POS'], [BarChart3, 'Sales, stock and cost reports'], [ShieldCheck, 'Role-based access and full audit trail']].map(([I, t]) => <li key={t} className="flex items-center gap-3"><span className="rounded-lg bg-white/10 p-2"><I size={18} /></span>{t}</li>)}</ul></div>
        <p className="relative text-sm text-white/50">Secure staff sign-in</p>
      </div>
      <div className="flex items-center justify-center bg-canvas p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white lg:hidden"><UtensilsCrossed /></span><h1 className="text-2xl font-semibold">Welcome back</h1><p className="mt-1 text-sm text-muted">Sign in to your dashboard</p></div>
          <div className="space-y-4"><Field label="Email"><input className="input py-2.5" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
            <Field label="Password"><input className="input py-2.5" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
            {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button></div>
        </form>
      </div>
    </div>
  );
}
