'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createProgressBatchUpdate } from './actions';
import KavioActionGate from '../components/KavioActionGate';

type Config = { id_kategori: string; bobot_final: number | string };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };

export default function ProgressCreatePanel({
  idSpk,
  tglSpk,
  configs,
  categories,
  currentProgressRows,
  autoOpen = false,
}: {
  idSpk: string;
  tglSpk: string;
  configs: Config[];
  categories: Category[];
  completedCategoryIds: string[];
  currentProgressRows: Array<{ id_kategori: string; progress_akumulasi: number }>;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const categoryMap = useMemo(
    () => new Map(categories.map((row) => [row.id_kategori, row])),
    [categories],
  );
  const currentProgressMap = useMemo(
    () => new Map(currentProgressRows.map((row) => [row.id_kategori, Number(row.progress_akumulasi ?? 0)])),
    [currentProgressRows],
  );
  const sortedConfigs = useMemo(
    () => [...configs].sort((a, b) => (categoryMap.get(a.id_kategori)?.urutan ?? 999) - (categoryMap.get(b.id_kategori)?.urutan ?? 999)),
    [configs, categoryMap],
  );

  const today = new Date().toISOString().slice(0, 10);

  const entries = sortedConfigs.flatMap((config) => {
    const raw = values[config.id_kategori] ?? '';
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return [];
    return [{
      id_kategori: config.id_kategori,
      progress_percent: amount,
      keterangan: (notes[config.id_kategori] ?? '').trim() || null,
    }];
  });

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    const focusFirst = () => {
      const target = sessionStorage.getItem('kavio_focus_target');
      if (target !== 'progress_batch_first') return;
      sessionStorage.removeItem('kavio_focus_target');
      window.setTimeout(() => firstInputRef.current?.focus(), 60);
    };

    const handleFocusRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target !== 'progress_batch_first') return;
      sessionStorage.removeItem('kavio_focus_target');
      window.setTimeout(() => firstInputRef.current?.focus(), 60);
    };

    if (open) focusFirst();
    window.addEventListener('kavio-focus-request', handleFocusRequest);
    return () => window.removeEventListener('kavio-focus-request', handleFocusRequest);
  }, [open]);

  const closePanel = () => {
    setOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('panel');
    next.delete('focus');
    next.delete('error');
    const query = next.toString();
    router.replace(query ? `/progress?${query}` : '/progress', { scroll: false });
  };

  const showError = (title: string, message: string) => {
    window.dispatchEvent(new CustomEvent('kavio-message', {
      detail: { tone: 'error', title, message, focusTarget: 'progress_batch_first' },
    }));
  };

  const validateBeforeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!entries.length) {
      event.preventDefault();
      showError('BELUM ADA PROGRESS', 'Isi minimal satu kategori pada kolom INPUT PERIODE sebelum menyimpan.');
      return;
    }

    for (const entry of entries) {
      const currentPct = (currentProgressMap.get(entry.id_kategori) ?? 0) * 100;
      const nextPct = currentPct + entry.progress_percent;
      if (entry.progress_percent <= 0 || nextPct > 100.000001) {
        event.preventDefault();
        const category = categoryMap.get(entry.id_kategori);
        const maxAllowed = Math.max(0, 100 - currentPct);
        showError(
          'PROGRESS MELEBIHI 100%',
          `${category?.nama_kategori ?? entry.id_kategori}: progress saat ini ${currentPct.toFixed(2)}%. Maksimal tambahan ${maxAllowed.toFixed(2)}%.`,
        );
        return;
      }
    }
  };

  let firstEditableAssigned = false;

  return (
    <KavioActionGate action="PROGRESS_WRITE">
      <div className="progress-create-wrap">
        {!open && (
          <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
            <span className="kavio-command-icon" aria-hidden="true">+</span>
            <span>Input Progress Batch</span>
          </button>
        )}

        {open && (
          <section className="kavio-panel progress-create-panel kavio-batch-entry">
            <div className="kavio-panel-head progress-create-head">
              <div>
                <h2 className="kavio-panel-title">INPUT PROGRESS BATCH</h2>
                <div className="kavio-panel-note">
                  Isi hanya kategori yang berubah. Beberapa kategori dapat disimpan sekaligus dalam satu transaksi.
                </div>
              </div>
              <button type="button" className="kavio-command-button secondary progress-form-close" onClick={closePanel}>
                <span className="kavio-command-icon" aria-hidden="true">×</span><span>Tutup Form</span>
              </button>
            </div>

            <form action={createProgressBatchUpdate} onSubmit={validateBeforeSubmit}>
              <input type="hidden" name="id_spk" value={idSpk} />
              <input type="hidden" name="entries_json" value={JSON.stringify(entries)} />

              <div className="kavio-batch-toolbar">
                <label className="kavio-field">
                  <span>TANGGAL UPDATE</span>
                  <input type="date" name="tanggal_update" min={tglSpk} max={today} defaultValue={today} required />
                </label>
                <div className="kavio-batch-summary">
                  <span className="kavio-badge">{entries.length} KATEGORI DIISI</span>
                  <span>Kolom kosong tidak ikut disimpan.</span>
                </div>
              </div>

              <div className="kavio-table-wrap">
                <table className="kavio-table kavio-batch-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>KATEGORI</th>
                      <th>BOBOT</th>
                      <th>SAAT INI</th>
                      <th>SISA</th>
                      <th>INPUT PERIODE (%)</th>
                      <th>SETELAH INPUT</th>
                      <th>KETERANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedConfigs.map((config) => {
                      const category = categoryMap.get(config.id_kategori);
                      const currentPct = Math.max(0, Math.min(100, (currentProgressMap.get(config.id_kategori) ?? 0) * 100));
                      const remainingPct = Math.max(0, 100 - currentPct);
                      const rawValue = values[config.id_kategori] ?? '';
                      const periodPct = Number(rawValue || 0);
                      const afterPct = Math.min(100, currentPct + (Number.isFinite(periodPct) ? periodPct : 0));
                      const completed = remainingPct <= 0.000001;
                      const assignRef = !completed && !firstEditableAssigned;
                      if (assignRef) firstEditableAssigned = true;

                      return (
                        <tr key={config.id_kategori} className={completed ? 'kavio-batch-row-complete' : ''}>
                          <td>{category?.urutan ?? '—'}</td>
                          <td>{category?.nama_kategori ?? config.id_kategori}</td>
                          <td className="kavio-number">{(Number(config.bobot_final) * 100).toFixed(2)}%</td>
                          <td className="kavio-number">{currentPct.toFixed(2)}%</td>
                          <td className="kavio-number">{remainingPct.toFixed(2)}%</td>
                          <td>
                            <input
                              ref={assignRef ? firstInputRef : undefined}
                              className="kavio-batch-input kavio-number"
                              type="number"
                              min="0"
                              max={remainingPct}
                              step="0.01"
                              inputMode="decimal"
                              placeholder={completed ? 'SELESAI' : '0'}
                              value={rawValue}
                              disabled={completed}
                              onChange={(event) => setValues((prev) => ({ ...prev, [config.id_kategori]: event.target.value }))}
                            />
                          </td>
                          <td className="kavio-number kavio-batch-after">{afterPct.toFixed(2)}%</td>
                          <td>
                            <input
                              className="kavio-batch-input kavio-batch-note"
                              type="text"
                              placeholder={completed ? 'SELESAI' : 'Opsional'}
                              value={notes[config.id_kategori] ?? ''}
                              disabled={completed}
                              onChange={(event) => setNotes((prev) => ({ ...prev, [config.id_kategori]: event.target.value }))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="kavio-batch-footer">
                <div className="kavio-form-note">
                  <strong>PENTING:</strong> Angka pada INPUT PERIODE adalah tambahan progress, bukan nilai kumulatif.
                  Sistem tetap memvalidasi batas 100% dan menyimpan seluruh batch secara atomic.
                </div>
                <button type="submit" className="kavio-button" disabled={!entries.length}>
                  SIMPAN {entries.length ? `${entries.length} KATEGORI` : 'PROGRESS'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </KavioActionGate>
  );
}
