'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createFasumSpk } from './actions';
import KavioActionGate from '../../components/KavioActionGate';
import KavioFormModal from '../../components/KavioFormModal';

type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type WorkItem = { nama_pekerjaan: string; bobot_percent: string };

export default function FasumSpkCreatePanel({ kantorRows, mandorRows }: { kantorRows: Kantor[]; mandorRows: Mandor[] }) {
  const [open, setOpen] = useState(false);
  const [selectedKantor, setSelectedKantor] = useState('');
  const [items, setItems] = useState<WorkItem[]>([{ nama_pekerjaan: '', bobot_percent: '' }]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mandors = useMemo(() => mandorRows.filter((row) => row.id_kantor === selectedKantor), [mandorRows, selectedKantor]);
  const payload = items.map((item) => ({ nama_pekerjaan: item.nama_pekerjaan.trim(), bobot: Number(item.bobot_percent) / 100 }));
  const total = items.reduce((sum, item) => sum + (Number(item.bobot_percent) || 0), 0);

  useEffect(() => {
    if (searchParams.get('form') === 'spk-fasum-create') setOpen(true);
    if (searchParams.get('success')) setOpen(false);
  }, [searchParams]);

  const close = () => {
    setOpen(false);
    if (searchParams.get('form') !== 'spk-fasum-create') return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('form');
    next.delete('error');
    next.delete('focus');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const updateItem = (index: number, key: keyof WorkItem, value: string) => {
    setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  return (
    <KavioActionGate action="SPK_WRITE">
      <div className="kavio-create-wrap">
        <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
          <span className="kavio-command-icon" aria-hidden="true">+</span><span>Tambah SPK Fasum</span>
        </button>
        <KavioFormModal open={open} onClose={close} size="wide" ariaLabel="Input SPK Fasum" closeOnBackdrop={false} persistenceKey="spk-fasum-create">
          <section className="kavio-panel">
            <div className="kavio-panel-head">
              <div><h2 className="kavio-panel-title">INPUT SPK FASUM</h2><div className="kavio-panel-note">Rincian pekerjaan dan bobot dibuat khusus untuk setiap objek Fasum.</div></div>
              <button type="button" className="kavio-command-button secondary" onClick={close}><span className="kavio-command-icon" aria-hidden="true">×</span><span>Tutup Form</span></button>
            </div>
            <form action={createFasumSpk} className="kavio-form">
              <label className="kavio-field"><span>NAMA OBJEK FASUM</span><input name="nama_objek" required placeholder="Contoh: Jalan Utama Blok A" /></label>
              <label className="kavio-field"><span>TANGGAL SPK</span><input name="tgl_spk" type="date" required /></label>
              <label className="kavio-field"><span>TARGET SELESAI</span><input name="tgl_target_selesai" type="date" required /></label>
              <label className="kavio-field"><span>KANTOR / PELAKSANA</span><select name="id_kantor" required value={selectedKantor} onChange={(event) => setSelectedKantor(event.target.value)}><option value="">PILIH KANTOR</option>{kantorRows.map((row) => <option key={row.id_kantor} value={row.id_kantor}>{row.nama_kantor_pelaksana}</option>)}</select></label>
              <label className="kavio-field"><span>MANDOR</span><select name="id_mandor" required defaultValue=""><option value="">PILIH MANDOR</option>{mandors.map((row) => <option key={row.id_mandor} value={row.id_mandor}>{row.nama_mandor}</option>)}</select></label>
              <input type="hidden" name="items_json" value={JSON.stringify(payload)} />
              <div className="kavio-panel-head"><div><h3 className="kavio-panel-title">ITEM PEKERJAAN DAN BOBOT</h3><div className="kavio-panel-note">Total bobot seluruh item wajib 100%.</div></div><span className={`kavio-badge ${Math.abs(total - 100) > 0.001 ? 'kavio-badge-warning' : ''}`}>TOTAL {total.toFixed(2)}%</span></div>
              <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>URUTAN</th><th>NAMA PEKERJAAN</th><th>BOBOT (%)</th><th>AKSI</th></tr></thead><tbody>
                {items.map((item, index) => <tr key={index}><td>{index + 1}</td><td><input aria-label={`Nama pekerjaan ${index + 1}`} value={item.nama_pekerjaan} required onChange={(event) => updateItem(index, 'nama_pekerjaan', event.target.value)} /></td><td><input aria-label={`Bobot pekerjaan ${index + 1}`} type="number" min="0.01" max="100" step="0.01" value={item.bobot_percent} required onChange={(event) => updateItem(index, 'bobot_percent', event.target.value)} /></td><td><button type="button" className="kavio-button secondary" disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>HAPUS</button></td></tr>)}
              </tbody></table></div>
              <div className="kavio-actions"><button type="button" className="kavio-button secondary" onClick={() => setItems((rows) => [...rows, { nama_pekerjaan: '', bobot_percent: '' }])}>TAMBAH ITEM</button><button type="submit" className="kavio-button" disabled={!items.length || Math.abs(total - 100) > 0.001 || !kantorRows.length}>SIMPAN SPK FASUM SEBAGAI DRAFT</button></div>
            </form>
          </section>
        </KavioFormModal>
      </div>
    </KavioActionGate>
  );
}
