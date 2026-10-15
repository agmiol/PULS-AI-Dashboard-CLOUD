import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Будь ласка, введіть логін та пароль.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Try server verification via API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      let isValid = false;

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          isValid = true;
        }
      } else {
        // Fallback validation on client side for exact match
        const validUsername = 'pulsadmin';
        // Handle both en-dash (–) and hyphen (-) in password string
        const validPasswords = ['jC&T–F)]CX@?8hh', 'jC&T-F)]CX@?8hh'];
        if (username.trim() === validUsername && validPasswords.includes(password.trim())) {
          isValid = true;
        }
      }

      if (isValid) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('puls_auth', 'true');
        storage.setItem('puls_user', 'pulsadmin');
        onLoginSuccess();
      } else {
        setError('Невірний логін або пароль. Спробуйте ще раз.');
      }
    } catch (err) {
      // Client-side fallback check in case of network issues
      const validUsername = 'pulsadmin';
      const validPasswords = ['jC&T–F)]CX@?8hh', 'jC&T-F)]CX@?8hh'];
      if (username.trim() === validUsername && validPasswords.includes(password.trim())) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('puls_auth', 'true');
        storage.setItem('puls_user', 'pulsadmin');
        onLoginSuccess();
      } else {
        setError('Невірний логін або пароль.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d1e] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">
      {/* Background Decorative Radial Glow & Grid matching pulse.gov.ua */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-[#070d1e] to-[#050814] pointer-events-none" />
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] pointer-events-none" 
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-[#0b1328] border border-blue-500/30 p-3 mb-4 shadow-xl shadow-blue-950/70 ring-4 ring-blue-500/10 flex items-center justify-center">
            <img src="/Pulse_logo.svg" alt="Платформа Пульс" className="w-full h-full object-contain" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20 mb-2.5">
            PULSE.GOV.UA
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Система аналітики <span className="text-blue-400">ПУЛЬС</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 font-medium max-w-xs sm:max-w-none">
            Введіть облікові дані для доступу до аналітичного дашборду
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111a30]/95 backdrop-blur-2xl border border-blue-900/40 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Banner */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Логін
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введіть логін..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#0a1124] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                Пароль
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введіть пароль..."
                  className="w-full pl-10 pr-10 py-3 text-sm bg-[#0a1124] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                  title={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-[#0a1124] text-blue-600 focus:ring-blue-500/50 cursor-pointer"
                />
                <span className="font-semibold">Запам'ятати мене на цьому пристрої</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:from-blue-700 active:to-blue-800 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30 disabled:opacity-50 mt-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Перевірка даних...</span>
                </>
              ) : (
                <>
                  <span>Увійти в систему</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 text-slate-400 text-xs font-medium">
          <p>Вхід дозволено лише уповноваженим користувачам аналітичного комплексу.</p>
          <p className="mt-1.5 text-[11px] text-slate-500">ПУЛЬС © 2026 • ДЕРЖАВНО-ПРИВАТНИЙ ДІАЛОГ</p>
        </div>
      </div>
    </div>
  );
};
