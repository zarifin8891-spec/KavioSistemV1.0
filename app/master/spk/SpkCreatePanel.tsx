'use client';

import { useState } from 'react';
import { createSpk } from './actions';
import KavioActionGate from '../../components/KavioActionGate';
import WeightConfigurator from './WeightConfigurator';

type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };
type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };

export default function SpkCreatePanel({
  kavlingRows,
  kategoriRows,
  templateRows,
  kantorRows,
  mandorRows,
}: {
  kavlingRows: Kavling[];
  kategoriRows: Kategori[];
  templateRows: Template[];
  kantorRows: Kantor[];
  mandorRows: Mandor[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <KavioActionGate action="SPK_WRITE">
      <div className="kavio-create-wrap">
        <button type="button" className="kavio-command-button" onClick={() => setOpen((value) => !value)}>
          <span className="kavio-command-icon" aria-hidden="true">{open ? '×' : '+'}</span><span>{open ? 'Tutup Form' : 'Tambah SPK'}</span>
        </button>

        {open && (
        <section className="kavio-panel kvio-create-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">INPUT SPK BARU</h2>
              <div className="kavio-panel-note">Satu kavling hanya memiliki satu SPK. Jika masih ada SPK DRAFT untuk kavling yang dipilih, data akan diperbarui pada SPK tersebut lalu diaktifkan.</div>
            </div>
            <span className="kavio-badge">DRAFT</span>
          </div>
          <form action={createSpk} className="kavio-form kvio-spk-form">
            <WeightConfigurator kavlingRows={kavlingRows} kategoriRows={kategoriRows} templateRows={templateRows} />
            <label className="kavio-field"><span>TANGGAL SPK</span><input name="tgl_spk" type="date" required /></label>
            <label className="kavio-field"><span>TARGET SELESAI</span><input name="tgl_target_selesai" type="date" required /></label>
            <label className="kavio-field"><span>KANTOR / PELAKSANA</span><select name="id_kantor" required defaultValue=""><option value="" disabled>PILIH KANTOR</option>{kantorRows.map((item) => <option key={item.id_kantor} value={item.id_kantor}>{item.nama_kantor_pelaksana}</option>)}</select></label>
            <label className="kavio-field"><span>MANDOR</span><select name="id_mandor" required defaultValue=""><option value="" disabled>PILIH MANDOR</option>{mandorRows.map((item) => <option key={item.id_mandor} value={item.id_mandor}>{item.nama_mandor} — {item.id_kantor}</option>)}</select></label>
            <div className="kavio-form-note"><strong>ATURAN:</strong> Satu kavling hanya boleh memiliki satu SPK. Jika sudah ada SPK DRAFT, sistem menggunakan record tersebut, memperbarui datanya, lalu mengaktifkannya. SPK baru hanya untuk kavling AVAILABLE atau BOOKING. Saat aktif, kavling menjadi BUILDING. Mandor harus berasal dari kantor yang dipilih dan tipe rumah SPK mengikuti kavling.</div>
            <div className="kavio-actions"><button type="submit" className="kavio-button" disabled={!kavlingRows.length || !kantorRows.length || !mandorRows.length || !kategoriRows.length}>SIMPAN SPK SEBAGAI DRAFT</button></div>
          </form>
        </section>
        )}
      </div>
    </KavioActionGate>
  );
}
