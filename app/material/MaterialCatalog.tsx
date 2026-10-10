'use client';

import { useMemo, useState } from 'react';

type Material = { id_material: string; kode_referensi: string | null; nama_material: string; kategori: string; satuan: string; jenis_item: string };

export default function MaterialCatalog({ materials }: { materials: Material[] }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const rows = useMemo(() => materials.filter((row) => (!kind || row.jenis_item === kind) && `${row.kode_referensi ?? ''} ${row.nama_material} ${row.kategori}`.toLocaleLowerCase('id-ID').includes(search.toLocaleLowerCase('id-ID'))), [materials, search, kind]);
  return <section className="kavio-panel">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">MASTER MATERIAL</h2><div className="kavio-panel-note">Daftar material RAB. Saldo stok terbentuk setelah penerimaan atau input saldo awal.</div></div><span className="kavio-badge">{materials.length} ITEM</span></div>
    <div className="material-catalog-filter">
      <label className="kavio-field"><span>CARI MATERIAL</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama, kode, atau kategori" /></label>
      <label className="kavio-field"><span>JENIS ITEM</span><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">SEMUA JENIS</option>{Array.from(new Set(materials.map((row) => row.jenis_item))).sort().map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
    </div>
    <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KODE</th><th>NAMA MATERIAL</th><th>KATEGORI</th><th>SATUAN</th><th>JENIS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id_material}><td>{row.kode_referensi || '—'}</td><td>{row.nama_material}</td><td>{row.kategori}</td><td>{row.satuan}</td><td><span className="kavio-badge">{row.jenis_item.replaceAll('_', ' ')}</span></td></tr>)}{!rows.length && <tr><td colSpan={5} className="kavio-empty">{materials.length ? 'TIDAK ADA MATERIAL SESUAI FILTER.' : 'BELUM ADA MASTER MATERIAL.'}</td></tr>}</tbody></table></div>
    <div className="kavio-panel-body material-subtext">Menampilkan {rows.length} dari {materials.length} item.</div>
  </section>;
}
