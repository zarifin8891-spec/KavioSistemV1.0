'use client';

import { useEffect, useRef, useState } from 'react';
import { createProgressUpdate } from './actions';
import KavioActionGate from '../components/KavioActionGate';
import { useRouter, useSearchParams } from 'next/navigation';

type Config = { id_kategori: string; bobot_final: number | string };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };

export default function ProgressCreatePanel({
  idSpk,
  tglSpk,
  configs,
  categories,
  completedCategoryIds,
  autoOpen = false,
}: {
  idSpk: string;
  tglSpk: string;
  configs: Config[];
  categories: Category[];
  completedCategoryIds: string[];
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const progressInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const categoryMap = new Map(categories.map((row) => [row.id_kategori, row]));
  const completedSet = new Set(completedCategoryIds);
  const availableConfigs = configs.filter((config) => !completedSet.has(config.id_kategori));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    const focusProgress = () => {
      const target = sessionStorage.getItem('kavio_focus_target');
      if (target !== 'progress_periode') return;
      sessionStorage.removeItem('kavio_focus_target');
      window.setTimeout(() => progressInputRef.current?.focus(), 80);
    };

    const handleFocusRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target !== 'progress_periode') return;
      sessionStorage.removeItem('kavio_focus_target');
      window.setTimeout(() => progressInputRef.current?.focus(), 80);
    };

    if (open) focusProgress();
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

  return (
    <KavioActionGate action="PROGRESS_WRITE">
      <div className="progress-create-wrap">
        {!open && (
        <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
          <span className="kavio-command-icon" aria-hidden="true">+</span><span>Input Progress</span>
        </button>
      )}

      {open && (
        <section className="kavio-panel progress-create-panel">
          <div className="kavio-panel-head progress-create-head">
            <div>
              <h2 className="kavio-panel-title">INPUT PROGRESS PERIODE</h2>
              <div className="kavio-panel-note">Masukkan progress periode, bukan angka kumulatif. Sistem menghitung akumulasi dan progress berbobot.</div>
            </div>
            <button type="button" className="kavio-command-button secondary progress-form-close" onClick={closePanel}>
              <span className="kavio-command-icon" aria-hidden="true">×</span><span>Tutup Form</span>
            </button>
          </div>
          <form action={createProgressUpdate} className="kavio-form progress-input-form">
            <input type="hidden" name="id_spk" value={idSpk} />
            <label className="kavio-field"><span>TANGGAL UPDATE</span><input type="date" name="tanggal_update" min={tglSpk} defaultValue={today} required /></label>
            <label className="kavio-field"><span>KATEGORI PEKERJAAN</span><select name="id_kategori" defaultValue="" required><option value="" disabled>PILIH KATEGORI</option>{availableConfigs.map((config) => { const category = categoryMap.get(config.id_kategori); return <option key={config.id_kategori} value={config.id_kategori}>{category?.urutan ?? ''}. {category?.nama_kategori ?? config.id_kategori} — BOBOT {(Number(config.bobot_final) * 100).toFixed(2)}%</option>; })}</select></label>
            <label className="kavio-field"><span>PROGRESS PERIODE (%)</span><input ref={progressInputRef} type="number" name="progress_periode" min="0" max="100" step="0.01" placeholder="CONTOH: 8" required /></label>
            <label className="kavio-field"><span>KETERANGAN</span><input name="keterangan" placeholder="KETERANGAN PEKERJAAN (OPSIONAL)" /></label>
            <div className="kavio-form-note"><strong>PENTING:</strong> Nilai 0–100% adalah progress untuk periode tersebut. Riwayat tetap disimpan dan akumulasi kategori dihitung sistem.{availableConfigs.length ? "" : " Seluruh kategori sudah mencapai 100%."}</div>
            <div className="kavio-actions"><button type="submit" className="kavio-button progress-submit-button" disabled={!availableConfigs.length}>SIMPAN PROGRESS PERIODE</button></div>
          </form>
        </section>
        )}
      </div>
    </KavioActionGate>
  );
}
