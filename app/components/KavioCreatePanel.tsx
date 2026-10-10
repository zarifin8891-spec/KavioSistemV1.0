'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import KavioFormModal from './KavioFormModal';

function prettyLabel(value: string) {
  return value
    .replaceAll('+', '')
    .replaceAll('×', '')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function KavioCreatePanel({
  buttonLabel,
  title,
  note,
  badge,
  children,
  triggerTargetId,
  modalSize = 'standard',
  formKey,
}: {
  buttonLabel: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
  triggerTargetId?: string;
  modalSize?: 'compact' | 'standard' | 'wide' | 'full';
  formKey?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!formKey) return;
    if (searchParams.get('form') === formKey) {
      setOpen(true);
      return;
    }
    if (searchParams.get('success')) setOpen(false);
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

  const trigger = (
    <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
      <span className="kavio-command-icon" aria-hidden="true">+</span>
      <span>{prettyLabel(buttonLabel)}</span>
    </button>
  );

  const modal = (
    <KavioFormModal open={open} onClose={close} size={modalSize} ariaLabel={title} closeOnBackdrop={false} persistenceKey={formKey}>
      <section className="kavio-panel kavio-create-panel">
        <div className="kavio-panel-head">
          <div>
            <h2 className="kavio-panel-title">{title}</h2>
            {note && <div className="kavio-panel-note">{note}</div>}
          </div>
          {badge && <span className="kavio-badge">{badge}</span>}
        </div>
        {children}
      </section>
    </KavioFormModal>
  );

  if (triggerTargetId) {
    const target = mounted ? document.getElementById(triggerTargetId) : null;
    return (
      <>
        {target ? createPortal(trigger, target) : null}
        {modal}
      </>
    );
  }

  return (
    <div className="kavio-create-wrap">
      {trigger}
      {modal}
    </div>
  );
}
