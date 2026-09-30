'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import KavioFormModal from './KavioFormModal';

export default function KavioCreatePanel({
  buttonLabel,
  closeLabel = '× TUTUP FORM',
  title,
  note,
  badge,
  children,
  triggerTargetId,
  headerActions,
  modalSize = 'standard',
}: {
  buttonLabel: string;
  closeLabel?: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
  triggerTargetId?: string;
  headerActions?: React.ReactNode;
  modalSize?: 'compact' | 'standard' | 'wide' | 'full';
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = () => setOpen(false);

  const trigger = (
    <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
      <span className="kavio-command-icon" aria-hidden="true">+</span>
      <span>{buttonLabel.replace(/^+s*/, '').toLowerCase().replace(/w/g, (char) => char.toUpperCase())}</span>
    </button>
  );

  const modal = (
    <KavioFormModal open={open} onClose={close} size={modalSize} ariaLabel={title}>
      <section className="kavio-panel kavio-create-panel">
        <div className="kavio-panel-head">
          <div>
            <h2 className="kavio-panel-title">{title}</h2>
            {note && <div className="kavio-panel-note">{note}</div>}
          </div>
          {badge && <span className="kavio-badge">{badge}</span>}
          <div className="kavio-create-head-actions">
            {headerActions}
            <button type="button" className="kavio-command-button secondary" onClick={close}>
              <span className="kavio-command-icon" aria-hidden="true">×</span>
              <span>{closeLabel.replace(/^[×+]?s*/, '').toLowerCase().replace(/w/g, (char) => char.toUpperCase())}</span>
            </button>
          </div>
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
