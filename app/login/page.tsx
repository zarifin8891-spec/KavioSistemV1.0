'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError('Email atau password tidak benar.');
      setLoading(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="kavio-login-page">
      <section className="kavio-login-card">
        <div className="kavio-login-brand">
          <div className="kavio-login-mark">K</div>
          <div>
            <div className="kavio-login-name">KAVIO</div>
            <div className="kavio-login-version">MONITOR V1.0</div>
          </div>
        </div>

        <div className="kavio-login-heading">
          <div className="kavio-login-eyebrow">EXECUTIVE PROJECT CONTROL</div>
          <h1>Masuk ke KAVIO</h1>
          <p>Pantau penjualan, pekerjaan, progress, dan kondisi proyek dari satu kendali.</p>
        </div>

        <form onSubmit={handleLogin} className="kavio-login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="nama@perusahaan.com"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
            />
          </label>

          {error && <div role="alert" className="kavio-login-error">{error}</div>}

          <button type="submit" disabled={loading} className="kavio-login-button">
            {loading ? 'Memproses...' : 'Masuk ke KAVIO'}
          </button>
        </form>

        <div className="kavio-login-footer">SATU DATA • SATU KENDALI • SATU HASIL</div>
      </section>
    </main>
  );
}
