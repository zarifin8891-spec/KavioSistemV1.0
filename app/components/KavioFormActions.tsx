'use client';

import {createContext, useContext} from 'react';

export const KavioFormContext = createContext<(() => void) | null>(null);

/** Shared input-form footer: primary action and close always occupy one row. */
export default function KavioFormActions({children, onClose, disabled=false}: {
  children: React.ReactNode;
  onClose?: () => void;
  disabled?: boolean;
}) {
  const modalClose=useContext(KavioFormContext);
  const close=onClose??modalClose;
  return <div className="kavio-actions kavio-form-actions">
    {children}
    {close&&<button type="button" className="kavio-button secondary" onClick={close} disabled={disabled}>Tutup Form</button>}
  </div>;
}
