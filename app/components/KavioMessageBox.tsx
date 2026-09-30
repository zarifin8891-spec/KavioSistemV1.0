'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function KavioMessageBox() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const success = searchParams.get('success');
  const focusTarget = searchParams.get('focus');
  const message = error || success;
  const tone = error ? 'error' : success ? 'success' : null;
  const key = useMemo(() => `${pathname}|${tone ?? ''}|${message ?? ''}|${searchParams.toString()}`, [pathname, tone, message, searchParams]);
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    if (message && dismissedKey !== key) {
      document.body.classList.add('kavio-messagebox-open');
      return () => document.body.classList.remove('kavio-messagebox-open');
    }
    document.body.classList.remove('kavio-messagebox-open');
  }, [message, dismissedKey, key]);

  if (!message || !tone || dismissedKey === key) return null;

  const close = () => {
    if (focusTarget) {
      sessionStorage.setItem('kavio_focus_target', focusTarget);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('kavio-focus-request', { detail: { target: focusTarget } }));
      }, 60);
    }

    setDismissedKey(key);

    const next = new URLSearchParams(searchParams.toString());
    next.delete('error');
    next.delete('success');
    next.delete('focus');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="kavio-messagebox-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) close();
    }}>
      <section
        className={`kavio-messagebox ${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kavio-messagebox-title"
        aria-describedby="kavio-messagebox-message"
      >
        <div className="kavio-messagebox-icon" aria-hidden="true">{tone === 'error' ? '!' : '✓'}</div>
        <div className="kavio-messagebox-content">
          <div id="kavio-messagebox-title" className="kavio-messagebox-title">
            {tone === 'error' ? 'DATA BELUM DAPAT DISIMPAN' : 'PROSES BERHASIL'}
          </div>
          <div id="kavio-messagebox-message" className="kavio-messagebox-message">{message}</div>
        </div>
        <button type="button" className="kavio-button kavio-messagebox-ok" autoFocus onClick={close}>OK</button>
      </section>
    </div>
  );
}
