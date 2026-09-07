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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f7fb' }}>
      <section style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 12px 40px rgba(0,0,0,.08)' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1.2, color: '#2563eb' }}>KAVIO</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 30 }}>Monitor V1.0</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Masuk untuk memantau proyek perumahan.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 16 }}
            />
          </label>

          {error && <div role="alert" style={{ padding: 12, borderRadius: 10, background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ padding: '13px 16px', border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 16, cursor: loading ? 'wait' : 'pointer' }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </section>
    </main>
  );
}
