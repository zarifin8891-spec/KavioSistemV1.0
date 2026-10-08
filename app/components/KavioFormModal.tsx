'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  clearKavioFormDraft,
  markKavioFormDraftPending,
  restoreKavioFormDraft,
  saveKavioFormDraft,
} from '../lib/kavio-form-state';

export default function KavioFormModal({
  open,
  onClose,
  closeHref,
  children,
  size = 'standard',
  ariaLabel = 'Form KAVIO',
  className = '',
  closeOnBackdrop = true,
  persistenceKey,
}: {
  open: boolean;
  onClose?: () => void;
  closeHref?: string;
  children: React.ReactNode;
  size?: 'compact' | 'standard' | 'wide' | 'full';
  ariaLabel?: string;
  className?: string;
  closeOnBackdrop?: boolean;
  persistenceKey?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousOpenRef = useRef(open);

  useEffect(() => setMounted(true), []);

  const clearDraft = useCallback(() => {
    if (persistenceKey) clearKavioFormDraft(persistenceKey);
  }, [persistenceKey]);

  const close = useCallback(() => {
    clearDraft();

    if (onClose) {
      onClose();
      return;
    }

    if (closeHref) {
      router.replace(closeHref, { scroll: false });
    }
  }, [clearDraft, closeHref, onClose, router]);

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = open;

    if (persistenceKey && wasOpen && !open) {
      clearKavioFormDraft(persistenceKey);
      return;
    }

    if (!open || !persistenceKey) return;

    const restore = () => {
      if (modalRef.current) restoreKavioFormDraft(persistenceKey, modalRef.current);
    };

    const immediate = window.setTimeout(restore, 0);
    const controlledStatePass = window.setTimeout(restore, 120);

    return () => {
      window.clearTimeout(immediate);
      window.clearTimeout(controlledStatePass);
    };
  }, [open, persistenceKey]);

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

  const persistDraft = () => {
    if (!persistenceKey || !modalRef.current) return;
    saveKavioFormDraft(persistenceKey, modalRef.current);
  };

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
        ref={modalRef}
        className={`kavio-form-modal kavio-form-modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onInputCapture={persistDraft}
        onChangeCapture={persistDraft}
        onSubmitCapture={() => {
          persistDraft();
          if (persistenceKey) {
            markKavioFormDraftPending(persistenceKey, window.location.pathname);
          }
        }}
        onClickCapture={(event) => {
          if (!persistenceKey || !closeHref) return;
          const target = event.target;
          if (!(target instanceof Element)) return;
          const anchor = target.closest('a');
          if (anchor?.getAttribute('href') === closeHref) clearDraft();
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
