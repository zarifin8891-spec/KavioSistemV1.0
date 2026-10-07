'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type LocalMessage = {
  tone: 'error' | 'success';
  message: string;
  title?: string;
  focusTarget?: string;
};

function fieldLabel(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = element.closest('label')?.querySelector('span')?.textContent?.trim();
  return label || element.getAttribute('aria-label') || element.name || 'Field';
}

function browserValidationMessage(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = fieldLabel(element);
  const validity = element.validity;

  if (validity.valueMissing) return `${label} wajib diisi.`;
  if (validity.rangeOverflow) return `${label} maksimal ${element.getAttribute('max') ?? 'nilai yang diizinkan'}.`;
  if (validity.rangeUnderflow) return `${label} minimal ${element.getAttribute('min') ?? 'nilai yang diizinkan'}.`;
  if (validity.stepMismatch) return `${label} tidak sesuai kelipatan nilai yang diizinkan.`;
  if (validity.typeMismatch) return `${label} tidak memiliki format yang valid.`;
  if (validity.patternMismatch) return `${label} tidak sesuai format yang diwajibkan.`;
  return element.validationMessage || `${label} belum valid.`;
}

function resolveFocusTarget(target: string) {
  if (!target) return null;
  const escaped = typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(target)
    : target.replace(/["\\]/g, '\\$&');

  return document.querySelector<HTMLElement>(
    `[data-kavio-focus="${escaped}"], #${escaped}, [name="${escaped}"]`,
  );
}

export default function KavioMessageBox() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const success = searchParams.get('success');
  const urlFocusTarget = searchParams.get('focus');
  const urlMessage = error || success;
  const urlTone: 'error' | 'success' | null = error ? 'error' : success ? 'success' : null;
  const urlKey = useMemo(
    () => `${pathname}|${urlTone ?? ''}|${urlMessage ?? ''}|${searchParams.toString()}`,
    [pathname, urlTone, urlMessage, searchParams],
  );

  const [dismissedKey, setDismissedKey] = useState('');
  const [localMessage, setLocalMessage] = useState<LocalMessage | null>(null);
  const invalidElementRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!urlMessage && dismissedKey) setDismissedKey('');
  }, [urlMessage, dismissedKey]);

  useEffect(() => {
    const handleKavioMessage = (event: Event) => {
      const detail = (event as CustomEvent<LocalMessage>).detail;
      if (!detail?.message) return;
      setLocalMessage({
        tone: detail.tone || 'error',
        message: detail.message,
        title: detail.title,
        focusTarget: detail.focusTarget,
      });
    };

    const handleInvalid = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;

      event.preventDefault();
      invalidElementRef.current = element;
      setLocalMessage({
        tone: 'error',
        title: 'DATA BELUM DAPAT DISIMPAN',
        message: browserValidationMessage(element),
      });
    };

    window.addEventListener('kavio-message', handleKavioMessage);
    document.addEventListener('invalid', handleInvalid, true);

    return () => {
      window.removeEventListener('kavio-message', handleKavioMessage);
      document.removeEventListener('invalid', handleInvalid, true);
    };
  }, []);

  const activeUrlMessage = Boolean(urlMessage && urlTone && dismissedKey !== urlKey);
  const active = localMessage || (activeUrlMessage && urlTone && urlMessage
    ? { tone: urlTone, message: urlMessage, focusTarget: urlFocusTarget ?? undefined }
    : null);

  useEffect(() => {
    if (active) {
      document.body.classList.add('kavio-messagebox-open');
      return () => document.body.classList.remove('kavio-messagebox-open');
    }
    document.body.classList.remove('kavio-messagebox-open');
  }, [active]);

  if (!active) return null;

  const close = () => {
    const focusTarget = localMessage?.focusTarget || urlFocusTarget || '';
    const invalidElement = invalidElementRef.current;

    invalidElementRef.current = null;

    if (localMessage) {
      setLocalMessage(null);
    } else {
      setDismissedKey(urlKey);

      const next = new URLSearchParams(searchParams.toString());
      next.delete('error');
      next.delete('success');
      next.delete('focus');
      const query = next.toString();
      const cleanUrl = query ? `${pathname}?${query}` : pathname;

      window.history.replaceState(window.history.state, '', cleanUrl);
      router.replace(cleanUrl, { scroll: false });
    }

    window.setTimeout(() => {
      if (focusTarget) {
        sessionStorage.setItem('kavio_focus_target', focusTarget);
        const target = resolveFocusTarget(focusTarget);
        if (target) {
          target.focus();
          if (target instanceof HTMLInputElement && !['number', 'date'].includes(target.type)) target.select?.();
          sessionStorage.removeItem('kavio_focus_target');
          return;
        }

        window.dispatchEvent(new CustomEvent('kavio-focus-request', { detail: { target: focusTarget } }));
        return;
      }

      invalidElement?.focus();
    }, 80);
  };

  return (
    <div className="kavio-messagebox-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) close();
    }}>
      <section
        className={`kavio-messagebox ${active.tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kavio-messagebox-title"
        aria-describedby="kavio-messagebox-message"
      >
        <div className="kavio-messagebox-icon" aria-hidden="true">{active.tone === 'error' ? '!' : '✓'}</div>
        <div className="kavio-messagebox-content">
          <div id="kavio-messagebox-title" className="kavio-messagebox-title">
            {active.title ?? (active.tone === 'error' ? 'DATA BELUM DAPAT DISIMPAN' : 'PROSES BERHASIL')}
          </div>
          <div id="kavio-messagebox-message" className="kavio-messagebox-message">{active.message}</div>
        </div>
        <button type="button" className="kavio-button kavio-messagebox-ok" autoFocus onClick={close}>OK</button>
      </section>
    </div>
  );
}
