'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import KavioFormModal from './KavioFormModal';

export default function KavioModalAction({
  buttonLabel,
  title,
  note,
  badge,
  children,
  size = 'standard',
  buttonClassName = 'kavio-button',
  closeOnBackdrop = false,
  formKey,
}: {
  buttonLabel: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
  size?: 'compact' | 'standard' | 'wide' | 'full';
  buttonClassName?: string;
  closeOnBackdrop?: boolean;
  formKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (formKey && searchParams.get('form') === formKey) setOpen(true);
  }, [formKey, searchParams]);

  const close = useCallback(() => {
    setOpen(false);
    if (!formKey || searchParams.get('form') !== formKey) return;

    const next = new URLSearchParams(searchParams.toString());
    next.delete('form');
    next.delete('error');
    next.delete('focus');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [formKey, pathname, router, searchParams]);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <KavioFormModal
        open={open}
        onClose={close}
        size={size}
        ariaLabel={title}
        closeOnBackdrop={closeOnBackdrop}
      >
        <section className="kavio-panel kavio-modal-action-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">{title}</h2>
              {note && <div className="kavio-panel-note">{note}</div>}
            </div>
            <div className="kavio-create-head-actions">
              {badge && <span className="kavio-badge">{badge}</span>}
              <button type="button" className="kavio-command-button secondary" onClick={close}>
                <span className="kavio-command-icon" aria-hidden="true">×</span>
                <span>Tutup Form</span>
              </button>
            </div>
          </div>
          {children}
        </section>
      </KavioFormModal>
    </>
  );
}
