'use client';

import { useState } from 'react';

export default function KavioCreatePanel({
  buttonLabel,
  closeLabel = '× TUTUP FORM',
  title,
  note,
  badge,
  children,
}: {
  buttonLabel: string;
  closeLabel?: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="kavio-create-wrap">
      <button type="button" className="kavio-command-button" onClick={() => setOpen((value) => !value)}>
        <span className="kavio-command-icon" aria-hidden="true">{open ? '×' : '+'}</span>
        <span>{open ? closeLabel.replace(/^[×+]?\s*/, '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : buttonLabel.replace(/^\+\s*/, '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}</span>
      </button>
      {open && (
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
      )}
    </div>
  );
}
