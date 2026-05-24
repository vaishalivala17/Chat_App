import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

function Field({ id, label, type = 'text', placeholder, autoComplete, value, error, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === 'password';
  const inputType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold tracking-wider uppercase text-muted-hi">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`input-base ${isPasswordField ? 'pr-11' : ''} ${error ? '!border-red-500 !ring-red-500/10' : ''}`}
          autoComplete={autoComplete || id}
        />
        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-black hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/30 transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1 animate-fade-in">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1.5 12s3.5-7 10.5-7 10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.6 10.6A3 3 0 0013.4 13.4M9.9 5.2A11.9 11.9 0 0112 5c7 0 10.5 7 10.5 7a18 18 0 01-3.4 4.2M6.4 6.4A18 18 0 001.5 12s3.5 7 10.5 7a11.7 11.7 0 005.6-1.4" />
    </svg>
  );
}

export default function AuthPage() {
  const [, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form,   setForm]   = useState({ username: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const { login, register } = useAuth();

  const validate = () => {
    const e = {};
    if (mode === 'register') {
      if (!form.username.trim()) e.username = 'Username is required';
      else if (form.username.length < 3) e.username = 'Min 3 characters';
      else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) e.username = 'Letters, numbers, underscores only';
      if (form.phone.trim() && !/^[0-9]{10,15}$/.test(form.phone.trim())) e.phone = 'Phone must be 10 to 15 digits';
    }
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = mode === 'forgot' ? 'New password is required' : 'Password is required';
    else if (form.password.length < 6) e.password = 'Min 6 characters';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerErr('');
    setInfoMsg('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else if (mode === 'register') {
        await register(form.username.trim(), form.email.trim(), form.password, form.phone.trim());
      } else if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.trim(), password: form.password }),
        });
        const body = await res.json();
        if (!res.ok) throw { response: { data: { message: body?.message || 'Failed to change password' } } };
        setInfoMsg(body.message || 'Password changed successfully. Please sign in.');
        setForm((p) => ({ ...p, password: '' }));
        setMode('login');
        setSearchParams({});
      }
    } catch (err) {
      setServerErr(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex bg-base overflow-hidden">
      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 relative bg-surface flex-col justify-between p-12 overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#00e5cc 1px, transparent 1px), linear-gradient(90deg, #00e5cc 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute w-80 h-80 rounded-full bg-cyan/10 blur-3xl -top-20 -left-20 pointer-events-none" />
        <div className="absolute w-64 h-64 rounded-full bg-cyan/5 blur-3xl bottom-20 right-10 pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan flex items-center justify-center font-bold text-base text-lg">P</div>
          <span className="text-xl font-bold tracking-wide">PULSE</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold leading-tight mb-4">
            Connect.<br/>
            <span className="text-cyan">Chat.</span><br/>
            Instantly.
          </h1>
          <p className="text-muted text-base font-light leading-relaxed max-w-sm">
            Real-time messaging with a clean interface. Send messages that arrive the moment you hit send.
          </p>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-wrap gap-3">
          {['⚡ Real-time', '🔒 JWT Auth', '💾 MongoDB', '🔄 Socket.IO'].map(f => (
            <span key={f} className="text-xs font-mono bg-card border border-border text-muted-hi px-3 py-1.5 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Logo (mobile) */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center font-bold text-base">P</div>
            <span className="font-bold tracking-wide">PULSE</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">
            {mode === 'login' && 'Welcome back'}
            {mode === 'register' && 'Create account'}
            {mode === 'forgot' && 'Forgot password'}
          </h2>
          <p className="text-muted text-sm mb-8">
            {mode === 'login' && (
              <>
                {"Don't have an account? "}
                <button
                  onClick={() => { setMode('register'); setErrors({}); setServerErr(''); setInfoMsg(''); }}
                  className="text-cyan hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                {'Already have one? '}
                <button
                  onClick={() => { setMode('login'); setErrors({}); setServerErr(''); setInfoMsg(''); }}
                  className="text-cyan hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <>
                {'Enter your email and a new password. '}
                <button
                  onClick={() => { setMode('login'); setErrors({}); setServerErr(''); setInfoMsg(''); }}
                  className="text-cyan hover:underline font-medium"
                >
                  Back to sign in
                </button>
              </>
            )}
          </p>

          {serverErr && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-sm text-red-400 mb-5 flex items-center gap-2 animate-fade-in">
              <span>✕</span> {serverErr}
            </div>
          )}
          {infoMsg && (
            <div className="bg-cyan/10 border border-cyan/25 rounded-xl px-4 py-3 text-sm text-cyan mb-5 flex items-center gap-2 animate-fade-in break-all">
              <span>✓</span> {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {mode === 'register' && (
              <Field
                id="username"
                label="Username"
                placeholder="cool_username"
                autoComplete="username"
                value={form.username}
                error={errors.username}
                onChange={(e) => {
                  setForm((p) => ({ ...p, username: e.target.value }));
                  if (errors.username) setErrors((p) => ({ ...p, username: '' }));
                }}
              />
            )}
            {mode === 'register' && (
              <Field
                id="phone"
                label="Phone Number (Optional)"
                type="tel"
                placeholder="e.g. 919876543210"
                autoComplete="tel"
                value={form.phone}
                error={errors.phone}
                onChange={(e) => {
                  setForm((p) => ({ ...p, phone: e.target.value.replace(/\s+/g, '') }));
                  if (errors.phone) setErrors((p) => ({ ...p, phone: '' }));
                }}
              />
            )}
            <Field
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              error={errors.email}
              onChange={(e) => {
                setForm((p) => ({ ...p, email: e.target.value }));
                if (errors.email) setErrors((p) => ({ ...p, email: '' }));
              }}
            />
            <Field
              id="password"
              label={mode === 'forgot' ? 'New password' : 'Password'}
              type="password"
              placeholder="Min 6 characters"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              error={errors.password}
              onChange={(e) => {
                setForm((p) => ({ ...p, password: e.target.value }));
                if (errors.password) setErrors((p) => ({ ...p, password: '' }));
              }}
            />
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setErrors({}); setServerErr(''); setInfoMsg(''); }}
                className="text-xs text-cyan hover:underline text-right -mt-3"
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {mode === 'login' && 'Signing in…'}
                  {mode === 'register' && 'Creating account…'}
                  {mode === 'forgot' && 'Changing password…'}
                </>
              ) : (
                <>
                  {mode === 'login' && 'Sign In →'}
                  {mode === 'register' && 'Create Account →'}
                  {mode === 'forgot' && 'Change Password →'}
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            By continuing, you agree to our <span className="text-cyan cursor-pointer">Terms</span> and <span className="text-cyan cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
