import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from './lib/supabase';

type AuthDialogProps = {
  onClose: () => void;
};

export function AuthDialog({ onClose }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (mode === 'signup' && !/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      setMessage('Username must be 3-24 letters, numbers, or underscores.');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      return;
    }

    setBusy(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage(error.message);
        else onClose();
      } else {
        const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo,
          },
        });

        if (error) setMessage(error.message);
        else if (data.session) onClose();
        else setMessage('Check your email to confirm your account, then sign in.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close account dialog" title="Close">
          <X size={19} aria-hidden="true" />
        </button>
        <h2 id="auth-title">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
        <div className="auth-tabs" role="group" aria-label="Account action">
          <button type="button" aria-pressed={mode === 'signin'} className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setMessage(''); }}>Sign in</button>
          <button type="button" aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setMessage(''); }}>Sign up</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
          </label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
