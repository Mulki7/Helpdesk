import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logoImg from '../../assets/logo.jpg';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/tickets';

  const fillDemo = () => {
    setEmail('admin@helpdesk.test');
    setPassword('Admin123!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Email atau password salah.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0d0f12] p-4 relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-emerald-950/20 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-[390px] relative z-10 bg-white rounded-3xl p-8 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] border border-white/20">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl p-1 bg-white shadow-md border border-slate-100 flex items-center justify-center mb-3.5">
            <img
              src={logoImg}
              alt="Ciheul Technologies"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Workspace Portal
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Ciheul Helpdesk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Masuk untuk mengelola tiket dan melayani customer
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@helpdesk.com"
                autoComplete="email"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-3 focus:ring-emerald-500/15 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-3 focus:ring-emerald-500/15 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-semibold bg-[#111111] text-white hover:bg-[#1f242c] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-black/20 flex items-center justify-center gap-2 group cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <>
                <span>Masuk ke Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill & Security Note */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5 text-center">
          <button
            type="button"
            onClick={fillDemo}
            className="text-[11px] text-slate-500 hover:text-emerald-700 transition-colors bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 cursor-pointer"
          >
            <span className="font-medium">Gunakan Akun Demo:</span>
            <span className="font-mono text-slate-700 font-semibold">admin</span>
          </button>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Koneksi terenkripsi & sesi aman</span>
          </div>
        </div>
      </div>
    </div>
  );
}

