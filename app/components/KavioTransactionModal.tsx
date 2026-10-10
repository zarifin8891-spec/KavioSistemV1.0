'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import KavioFormModal from './KavioFormModal';

export default function KavioTransactionModal({ title, focusIds, children }: {
  title: string; focusIds: string[]; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const focus = params.get('focus');
  const failed = Boolean(params.get('error') && focus && focusIds.includes(focus));
  useEffect(() => {
    if (failed) setOpen(true);
    else if (params.get('success')) setOpen(false);
  }, [failed, params]);
  const close = () => {
    setOpen(false);
    if (!failed) return;
    const next = new URLSearchParams(params.toString());
    ['form', 'error', 'focus'].forEach((key) => next.delete(key));
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  return <>
    <button type="button" className="kavio-command-button secondary" onClick={() => setOpen(true)}>{title}</button>
    <KavioFormModal open={open} onClose={close} size="standard" ariaLabel={title} closeOnBackdrop={false} persistenceKey={`transaction:${focusIds[0]}`}>
      <section className="kavio-panel kavio-transaction-panel">
        <div className="kavio-panel-head"><h2 className="kavio-panel-title">{title}</h2><button type="button" className="kavio-command-button secondary" onClick={close}>Tutup Form</button></div>
        {failed && <div className="kavio-alert error" role="alert">{params.get('error')}</div>}
        {children}
      </section>
    </KavioFormModal>
  </>;
}
