'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { KAVIO_LOGO_DATA_URI } from '../components/kavio-sidebar-logo';

const colors = {
  navy: '#04182F',
  navy2: '#08213D',
  navy3: '#173452',
  gold: '#D8B45A',
  champagne: '#F0D48A',
  ivory: '#F7F3E8',
  muted: '#C9BC99',
};

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
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: `radial-gradient(circle at 72% 0%, rgba(216,180,90,.08), transparent 28%), linear-gradient(135deg, ${colors.navy} 0%, #061D36 52%, ${colors.navy2} 100%)`,
        color: colors.ivory,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 460,
          padding: 26px 30px 28px,
          border: `1px solid rgba(216,180,90,.34)`,
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(18,49,80,.98), rgba(7,30,55,.98))',
          boxShadow: '0 18px 55px rgba(0,0,0,.30)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <img
            src={KAVIO_LOGO_DATA_URI}
            alt="KAVIO — Satu Data, Satu Kendali, Satu Hasil"
            style={{
              display: 'block',
              width: 'min(100%, 330px)',
              height: 'auto',
              maxHeight: 150,
              objectFit: 'contain',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, color: colors.ivory, fontSize: 30, lineHeight: 1.12 }}>Masuk ke KAVIO</h1>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 13 }}>
          <label style={{ display: 'grid', gap: 7, color: colors.ivory, fontSize: 11, fontWeight: 800 }}>
            <span>EMAIL</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="nama@perusahaan.com"
              style={{
                width: '100%',
                padding: '12px 13px',
                border: '1px solid rgba(232,204,122,.48)',
                borderRadius: 9,
                background: 'linear-gradient(180deg, #344C69, #293F5B)',
                color: colors.ivory,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, color: colors.ivory, fontSize: 11, fontWeight: 800 }}>
            <span>PASSWORD</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Password"
              style={{
                width: '100%',
                padding: '12px 13px',
                border: '1px solid rgba(232,204,122,.48)',
                borderRadius: 9,
                background: 'linear-gradient(180deg, #344C69, #293F5B)',
                color: colors.ivory,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <div
              role="alert"
              style={{
                padding: '11px 12px',
                borderRadius: 9,
                border: '1px solid #B91C1C',
                background: 'rgba(185,28,28,.10)',
                color: '#FCA5A5',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 3,
              padding: '12px 15px',
              border: 0,
              borderRadius: 9,
              background: `linear-gradient(180deg, ${colors.champagne}, ${colors.gold})`,
              color: '#0B1D3A',
              fontWeight: 900,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Memproses...' : 'Masuk ke KAVIO'}
          </button>
        </form>

      </section>
    </main>
  );
}
