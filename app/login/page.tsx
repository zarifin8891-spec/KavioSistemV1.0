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
  const [showPassword, setShowPassword] = useState(false);
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
          maxWidth: 350,
          padding: '20px 22px 22px',
          border: `1px solid rgba(216,180,90,.34)`,
          borderRadius: 18,
          background: 'linear-gradient(180deg, rgba(18,49,80,.98), rgba(7,30,55,.98))',
          boxShadow: '0 18px 55px rgba(0,0,0,.30)',
        }}
      >
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <img
            src={KAVIO_LOGO_DATA_URI}
            alt="KAVIO — Satu Data, Satu Kendali, Satu Hasil"
            style={{
              display: 'block',
              width: 'min(100%, 300px)',
              height: 'auto',
              margin: '0 auto',
            }}
          />
        </div>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: 10 }}>
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
                padding: '10px 12px',
                border: '1px solid rgba(232,204,122,.48)',
                borderRadius: 9,
                background: 'linear-gradient(180deg, #344C69, #293F5B)',
                color: colors.ivory,
                fontSize: 12,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, color: colors.ivory, fontSize: 11, fontWeight: 800 }}>
            <span>PASSWORD</span>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Password"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  border: '1px solid rgba(232,204,122,.48)',
                  borderRadius: 9,
                  background: 'linear-gradient(180deg, #344C69, #293F5B)',
                  color: colors.ivory,
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 8,
                  width: 28,
                  height: 28,
                  transform: 'translateY(-50%)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: colors.muted,
                  cursor: 'pointer',
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a3 3 0 0 0 4 4" />
                      <path d="M9.9 4.3A12.3 12.3 0 0 1 12 4c5.4 0 9.5 4 10.5 8-0.4 1.5-1.3 2.9-2.5 4.1" />
                      <path d="M6.2 6.2C4.4 7.5 2.9 9.5 1.5 12c1 4 5.1 8 10.5 8 1.4 0 2.7-.3 3.9-.8" />
                    </>
                  ) : (
                    <>
                      <path d="M1.5 12S5.1 4 12 4s10.5 8 10.5 8S18.9 20 12 20 1.5 12 1.5 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
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
              padding: '10px 13px',
              border: 0,
              borderRadius: 9,
              background: `linear-gradient(180deg, ${colors.champagne}, ${colors.gold})`,
              color: '#0B1D3A',
              fontWeight: 400,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

      </section>
    </main>
  );
}
