'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function KavioCreatePanel({
  buttonLabel,
  closeLabel = '× TUTUP FORM',
  title,
  note,
  badge,
  children,
  triggerTargetId,
  openTriggerTargetId,
}: {
  buttonLabel: string;
  closeLabel?: string;
  title: string;
  note?: string;
  badge?: string;
  children: React.ReactNode;
  triggerTargetId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trigger = (
    <button type="button" className="kavio-command-button" onClick={() => setOpen((value) => !value)}>
      <span className="kavio-command-icon" aria-hidden="true">{open ? '×' : '+'}</span>
      <span>{open ? closeLabel.replace(/^[×+]?\s*/, '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : buttonLabel.replace(/^\+\s*/, '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}</span>
    </button>
  );

  if (triggerTargetId) {
    const targetId = open ? (openTriggerTargetId ?? triggerTargetId) : triggerTargetId;
    const target = mounted ? document.getElementById(targetId) : null;
    return (
      <>
        {target ? createPortal(trigger, target) : null}
        {open && (
          <section className="kavio-panel kavio-create-panel">
            <div className="kavio-panel-head">
              <div>
                <h2 className="kavio-panel-title">{title}</h2>
                {note && <div className="kavio-panel-note">{note}</div>}
              </div>
              {badge && <span className="kavio-badge">{badge}</span>}
              {openTriggerTargetId && <div className="kavio-create-open-action-slot" aria-hidden="true" />}
            </div>
            {children}
          </section>
        )}
      </>
    );
  }

  return (
    <div className="kavio-create-wrap">
      {trigger}
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
