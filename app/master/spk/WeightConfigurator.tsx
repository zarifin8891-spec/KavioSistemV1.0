'use client';

import { useMemo, useState } from 'react';

type Kavling = { id_kavling: string; id_tipe: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };

type Props = {
  kavlingRows: Kavling[];
  kategoriRows: Kategori[];
  templateRows: Template[];
};

export default function WeightConfigurator({ kavlingRows, kategoriRows, templateRows }: Props) {
  const [selectedKavling, setSelectedKavling] = useState('');
  const [jenisBobot, setJenisBobot] = useState<'STANDAR' | 'CUSTOM'>('STANDAR');

  const selectedType = kavlingRows.find((row) => row.id_kavling === selectedKavling)?.id_tipe ?? '';
  const templateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of templateRows) {
      if (row.id_tipe === selectedType) map.set(row.id_kategori, Number(row.bobot_standar) * 100);
    }
    return map;
  }, [selectedType, templateRows]);

  const standardTotal = kategoriRows.reduce((sum, row) => sum + (templateMap.get(row.id_kategori) ?? 0), 0);

  return (
    <>
      <label className="kavio-field">
        <span>KAVLING</span>
        <select name="id_kavling" required value={selectedKavling} onChange={(event) => setSelectedKavling(event.target.value)}>
          <option value="" disabled>PILIH KAVLING</option>
          {kavlingRows.map((item) => <option key={item.id_kavling} value={item.id_kavling}>{item.id_kavling} — {item.id_tipe}</option>)}
        </select>
      </label>

      <label className="kavio-field">
        <span>JENIS BOBOT</span>
        <select name="jenis_bobot" required value={jenisBobot} onChange={(event) => setJenisBobot(event.target.value as 'STANDAR' | 'CUSTOM')}>
          <option value="STANDAR">STANDAR — DARI TEMPLATE TIPE RUMAH</option>
          <option value="CUSTOM">CUSTOM — ATUR SENDIRI</option>
        </select>
      </label>

      <div className="kvio-weight-config">
        <div className="kvio-weight-head">
          <div>
            <div className="kvio-weight-title">KONFIGURASI BOBOT PROGRESS</div>
            <div className="kvio-weight-note">
              {selectedKavling
                ? jenisBobot === 'STANDAR'
                  ? `Template untuk ${selectedKavling} (${selectedType}). Bobot akan disnapshot saat SPK dibuat.`
                  : `Isi bobot custom untuk ${selectedKavling}. Total wajib 100%.`
                : 'Pilih kavling terlebih dahulu. Bobot standar mengikuti tipe rumah kavling yang dipilih.'}
            </div>
          </div>
          <div className={`kavio-badge ${jenisBobot === 'CUSTOM' ? 'kavio-badge-warning' : ''}`}>
            {jenisBobot === 'STANDAR' ? `TEMPLATE ${standardTotal.toFixed(2)}%` : 'TOTAL WAJIB 100%'}
          </div>
        </div>

        <div className="kavio-table-wrap">
          <table className="kavio-table">
            <thead><tr><th>URUT</th><th>KATEGORI</th><th>BOBOT STANDAR</th><th>BOBOT CUSTOM (%)</th></tr></thead>
            <tbody>
              {kategoriRows.map((item) => {
                const standard = templateMap.get(item.id_kategori) ?? 0;
                return <tr key={item.id_kategori}>
                  <td>{item.urutan}</td>
                  <td>{item.nama_kategori}</td>
                  <td>{standard.toFixed(2)}%</td>
                  <td><input className="kavio-weight-input" name={`bobot_${item.id_kategori}`} type="number" min="0" max="100" step="0.01" defaultValue="0" disabled={jenisBobot !== 'CUSTOM'} /></td>
                </tr>;
              })}
              {!kategoriRows.length && <tr><td colSpan={4} className="kavio-empty">BELUM ADA KATEGORI PEKERJAAN AKTIF.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
