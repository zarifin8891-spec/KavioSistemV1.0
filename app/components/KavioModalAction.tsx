'use client';

import { useState } from 'react';
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
}: {
  buttonLabel: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
  size?: 'compact' | 'standard' | 'wide' | 'full';
  buttonClassName?: string;
  closeOnBackdrop?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      <KavioFormModal
        open={open}
        onClose={() => setOpen(false)}
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
              <button type="button" className="kavio-command-button secondary" onClick={() => setOpen(false)}>
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
