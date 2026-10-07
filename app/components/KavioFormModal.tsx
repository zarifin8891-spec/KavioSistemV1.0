'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

export default function KavioFormModal({
  open,
  onClose,
  closeHref,
  children,
  size = 'standard',
  ariaLabel = 'Form KAVIO',
  className = '',
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose?: () => void;
  closeHref?: string;
  children: React.ReactNode;
  size?: 'compact' | 'standard' | 'wide' | 'full';
  ariaLabel?: string;
  className?: string;
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }

    if (closeHref) {
      router.replace(closeHref, { scroll: false });
    }
  }, [closeHref, onClose, router]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [close, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="kavio-form-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.currentTarget === event.target) close();
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
