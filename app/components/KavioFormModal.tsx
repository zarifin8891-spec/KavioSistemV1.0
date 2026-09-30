'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function KavioFormModal({
  open,
  onClose,
  children,
  size = 'standard',
  ariaLabel = 'Form KAVIO',
  className = '',
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'compact' | 'standard' | 'wide' | 'full';
  ariaLabel?: string;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="kavio-form-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.currentTarget === event.target) onClose();
      }}
    >
      <div
        className={`kavio-form-modal kavio-form-modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
