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
      <label style={labelStyle}>
        <span>Kavling</span>
        <select name="id_kavling" required style={inputStyle} value={selectedKavling} onChange={(event) => setSelectedKavling(event.target.value)}>
          <option value="" disabled>Pilih kavling</option>
          {kavlingRows.map((item) => <option key={item.id_kavling} value={item.id_kavling}>{item.id_kavling} — {item.id_tipe}</option>)}
        </select>
      </label>

      <label style={labelStyle}>
        <span>Jenis Bobot</span>
        <select name="jenis_bobot" required style={inputStyle} value={jenisBobot} onChange={(event) => setJenisBobot(event.target.value as 'STANDAR' | 'CUSTOM')}>
          <option value="STANDAR">STANDAR — dari template tipe rumah</option>
          <option value="CUSTOM">CUSTOM — atur sendiri</option>
        </select>
      </label>

      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
        <div style={weightHeader}>
          <div>
            <div style={{ fontWeight: 800 }}>Konfigurasi Bobot Progress</div>
            <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
              {selectedKavling
                ? jenisBobot === 'STANDAR'
                  ? `Template untuk ${selectedKavling} (${selectedType}). Bobot akan disnapshot saat SPK dibuat.`
                  : `Isi bobot custom untuk ${selectedKavling}. Total wajib 100%.`
                : 'Pilih kavling terlebih dahulu. Bobot standar mengikuti tipe rumah kavling yang dipilih.'}
            </div>
          </div>
          <div style={noteBadge}>
            {jenisBobot === 'STANDAR' ? `Template ${standardTotal.toFixed(2)}%` : 'Total wajib 100%'}
          </div>
        </div>

        <div style={tableWrap}>
          <table style={table}>
            <thead><tr><th style={th}>Urut</th><th style={th}>Kategori</th><th style={th}>Bobot Standar</th><th style={th}>Bobot Custom (%)</th></tr></thead>
            <tbody>
              {kategoriRows.map((item) => {
                const standard = templateMap.get(item.id_kategori) ?? 0;
                return <tr key={item.id_kategori}>
                  <td style={td}>{item.urutan}</td>
                  <td style={tdStrong}>{item.nama_kategori}</td>
                  <td style={td}>{standard.toFixed(2)}%</td>
                  <td style={td}><input name={`bobot_${item.id_kategori}`} type="number" min="0" max="100" step="0.01" defaultValue="0" style={smallInput} disabled={jenisBobot !== 'CUSTOM'} /></td>
                </tr>;
              })}
              {!kategoriRows.length && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', padding: 30 }}>Belum ada kategori pekerjaan aktif.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 12, fontWeight: 700, color: '#475569' };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #cbd5e1', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#fff', color: '#0f172a' };
const smallInput = { ...inputStyle, maxWidth: 150 };
const tableWrap = { border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginTop: 12 };
const table = { width: '100%', borderCollapse: 'collapse' as const };
const th = { padding: '12px 14px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' as const };
const td = { padding: '13px 14px', borderBottom: '1px solid #f1f5f9' };
const tdStrong = { ...td, fontWeight: 800 };
const weightHeader = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const };
const noteBadge = { background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
