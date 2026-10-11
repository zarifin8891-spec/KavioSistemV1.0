'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {useFormStatus} from 'react-dom';
import { createProgressBatchUpdate } from './actions';
import KavioActionGate from '../components/KavioActionGate';
import KavioFormActions from '../components/KavioFormActions';
import KavioFormModal from '../components/KavioFormModal';

type WorkItem = { id_item: string; urutan: number; nama_pekerjaan: string; bobot_final: number | string; nama_kategori?:string; nama_mandor?:string; volume?:number|string; satuan?:string };

export default function ProgressCreatePanel({
  idSpk,
  tglSpk,
  workItems,
  currentProgressRows,
  autoOpen = false,
  detailed = false,
}: {
  idSpk: string;
  tglSpk: string;
  workItems: WorkItem[];
  currentProgressRows: Array<{ id_item: string; progress_akumulasi: number }>;
  autoOpen?: boolean;
  detailed?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const [values, setValues] = useState<Record<string, string>>({});
  const [category,setCategory]=useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const currentProgressMap = useMemo(
    () => new Map(currentProgressRows.map((row) => [row.id_item, Number(row.progress_akumulasi ?? 0)])),
    [currentProgressRows],
  );
  const sortedWorkItems = useMemo(() => [...workItems].filter(w=>(currentProgressMap.get(w.id_item)??0)<1).sort((a, b) => a.urutan - b.urutan), [workItems,currentProgressMap]);
  const visibleWorkItems=sortedWorkItems.filter(w=>!category||w.nama_kategori===category);
  const categories=[...new Set(sortedWorkItems.map(w=>w.nama_kategori).filter(Boolean))];

  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

  const entries = sortedWorkItems.flatMap((config) => {
    const raw = values[config.id_item] ?? '';
    const amount = Number(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) return [];
    return [{
      id_item: config.id_item,
      progress_percent: amount,
      keterangan: (notes[config.id_item] ?? '').trim() || null,
    }];
  });

  useEffect(() => {
    if (searchParams.get('success')) {
      setOpen(false);setValues({});setNotes({});
      return;
    }
    if (autoOpen) setOpen(true);
  }, [autoOpen, searchParams]);

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
    next.delete('form');
    next.delete('focus');
    next.delete('error');
    const query = next.toString();
    router.replace(query ? `/progress?${query}` : '/progress', { scroll: false });
  };

  const showError = (title: string, message: string, focusTarget = 'progress_batch_first') => {
    window.dispatchEvent(new CustomEvent('kavio-message', {
      detail: { tone: 'error', title, message, focusTarget },
    }));
  };

  const validateBeforeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const date=String(new FormData(event.currentTarget).get('tanggal_update')??'');
    if(!date||date<tglSpk||date>today){event.preventDefault();showError('TANGGAL TIDAK VALID','Tanggal wajib diisi, minimal tanggal SPK dan maksimal hari ini.','tanggal_update');return;}
    for(const [id,raw] of Object.entries(values)){if(!raw.trim())continue;const amount=Number(raw);if(!Number.isFinite(amount)||amount<0||Math.abs(amount*100-Math.round(amount*100))>1e-8){event.preventDefault();showError('PROGRESS TIDAK VALID','Progress harus berupa angka positif dengan maksimal dua desimal.',`progress_${id}`);return;}}

    if (!entries.length) {
      event.preventDefault();
      showError('BELUM ADA PROGRESS', 'Isi minimal satu item pada kolom INPUT PERIODE sebelum menyimpan.');
      return;
    }

    for (const entry of entries) {
      const currentPct = (currentProgressMap.get(entry.id_item) ?? 0) * 100;
      const nextPct = currentPct + entry.progress_percent;
      if (entry.progress_percent <= 0 || nextPct > 100.000001) {
        event.preventDefault();
        const maxAllowed = Math.max(0, 100 - currentPct);
        showError(
          'PROGRESS MELEBIHI 100%',
          `${sortedWorkItems.find((item) => item.id_item === entry.id_item)?.nama_pekerjaan ?? entry.id_item}: progress saat ini ${currentPct.toFixed(2)}%. Maksimal tambahan ${maxAllowed.toFixed(2)}%.`,
          `progress_${entry.id_item}`,
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
            <span>{detailed?'Input Progress Perincian':'Input Progress Batch'}</span>
          </button>
        )}

        <KavioFormModal open={open} onClose={closePanel} size="wide" className="kavio-table-entry-modal" ariaLabel={detailed?"Input Progress Perincian":"Input Progress Batch"} closeOnBackdrop={false} persistenceKey={`progress-create:${idSpk}`}>
          <section className="kavio-panel progress-create-panel kavio-batch-entry">
            <div className="kavio-panel-head progress-create-head">
              <div>
                <h2 className="kavio-panel-title">{detailed?'INPUT PROGRESS PERINCIAN':'INPUT PROGRESS BATCH'}</h2>
                <div className="kavio-panel-note">
                  Isi hanya item pekerjaan yang berubah. Beberapa item dapat disimpan sekaligus dalam satu transaksi.
                </div>
              </div>
              
            </div>

            <form noValidate className="kavio-panel-body" action={createProgressBatchUpdate} onSubmit={validateBeforeSubmit}>
              <input type="hidden" name="id_spk" value={idSpk} />
              <input type="hidden" name="entries_json" value={JSON.stringify(entries)} />

              <div className="kavio-batch-toolbar">
                <label className="kavio-field">
                  <span>TANGGAL UPDATE</span>
                  <input type="date" id="tanggal_update" name="tanggal_update" min={tglSpk} max={today} defaultValue={today} required />
                </label>
                {detailed&&<label className="kavio-field"><span>KATEGORI PEKERJAAN</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Semua Kategori</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}
                <div className="kavio-batch-summary">
                  <span className="kavio-badge">{entries.length} ITEM DIISI</span>
                  <span>Kolom kosong tidak ikut disimpan.</span>
                </div>
              </div>

              <div className="kavio-table-wrap">
                <table className={`kavio-table kavio-input-table kavio-batch-table ${detailed?'is-detailed':''}`}>
                  <colgroup><col className="kavio-col-order"/><col className="kavio-col-work"/>{detailed&&<col className="kavio-col-mandor"/>}<col className="kavio-col-percent"/><col className="kavio-col-percent"/><col className="kavio-col-percent"/><col className="kavio-col-period"/><col className="kavio-col-after"/><col className="kavio-col-note"/></colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>ITEM PEKERJAAN</th>
                      {detailed&&<th className="kavio-text-left">MANDOR</th>}
                      <th>BOBOT</th>
                      <th>SAAT INI</th>
                      <th>SISA</th>
                      <th>INPUT PERIODE (%)</th>
                      <th>SETELAH INPUT</th>
                      <th>KETERANGAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWorkItems.map((config) => {
                      const currentPct = Math.max(0, Math.min(100, (currentProgressMap.get(config.id_item) ?? 0) * 100));
                      const remainingPct = Math.max(0, 100 - currentPct);
                      const rawValue = values[config.id_item] ?? '';
                      const periodPct = Number(rawValue || 0);
                      const afterPct = Math.min(100, currentPct + (Number.isFinite(periodPct) ? periodPct : 0));
                      const completed = remainingPct <= 0.000001;
                      const assignRef = !completed && !firstEditableAssigned;
                      if (assignRef) firstEditableAssigned = true;

                      return (
                        <tr key={config.id_item} className={completed ? 'kavio-batch-row-complete' : ''}>
                          <td>{config.urutan}</td>
                          <td>{config.nama_pekerjaan}{detailed&&<div className="kavio-panel-note">{config.nama_kategori} · {Number(config.volume).toLocaleString('id-ID')} {config.satuan}</div>}</td>{detailed&&<td className="kavio-text-left">{config.nama_mandor}</td>}
                          <td className="kavio-number">{(Number(config.bobot_final) * 100).toFixed(2)}%</td>
                          <td className="kavio-number">{currentPct.toFixed(2)}%</td>
                          <td className="kavio-number">{remainingPct.toFixed(2)}%</td>
                          <td>
                            <input
                              ref={assignRef ? firstInputRef : undefined}
                              data-kavio-focus={`progress_${config.id_item}`}
                              name={`progress_${config.id_item}`}
                              aria-label={`Progress periode ${config.nama_pekerjaan}`}
                              className="kavio-batch-input kavio-batch-progress kavio-number"
                              type="number"
                              min="0"
                              max={remainingPct}
                              step="0.01"
                              inputMode="decimal"
                              placeholder={completed ? 'SELESAI' : '0'}
                              value={rawValue}
                              disabled={completed}
                              onChange={(event) => setValues((prev) => ({ ...prev, [config.id_item]: event.target.value }))}
                            />
                          </td>
                          <td className="kavio-number kavio-batch-after">{afterPct.toFixed(2)}%</td>
                          <td>
                            <input
                              className="kavio-batch-input kavio-batch-note"
                              name={`note_${config.id_item}`}
                              type="text"
                              placeholder={completed ? 'SELESAI' : 'Opsional'}
                              value={notes[config.id_item] ?? ''}
                              disabled={completed}
                              onChange={(event) => setNotes((prev) => ({ ...prev, [config.id_item]: event.target.value }))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {!visibleWorkItems.length&&<tr><td colSpan={detailed?9:8} className="kavio-empty">Tidak ada item yang masih memerlukan progress.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="kavio-batch-footer">
                <div className="kavio-form-note">
                  <strong>PENTING:</strong> Angka pada INPUT PERIODE adalah tambahan progress, bukan nilai kumulatif.
                  Sistem tetap memvalidasi batas 100% dan menyimpan seluruh batch secara atomic.
                </div>
                <KavioFormActions><ProgressSubmitButton count={entries.length}/></KavioFormActions>
              </div>
            </form>
          </section>
        </KavioFormModal>
      </div>
    </KavioActionGate>
  );
}

function ProgressSubmitButton({count}:{count:number}) {
 const {pending}=useFormStatus();
 return <button type="submit" className="kavio-button" disabled={pending||!count}>{pending?'MENYIMPAN…':`SIMPAN ${count?`${count} ITEM`:'PROGRESS'}`}</button>;
}
