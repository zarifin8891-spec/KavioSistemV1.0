'use client';

import { useState } from 'react';

import {
  createMaterialRequest,
  issueMaterialToSpk,
  postDirectMaterialUsage,
  postMaterialReceipt,
  postSpkMaterialUsage,
  postSupplierDirectUsage,
  reconcileSpkMaterial,
} from './actions';
import KavioActionGate from '../components/KavioActionGate';
import KavioTransactionModal from '../components/KavioTransactionModal';

type Material = { id_material: string; nama_material: string; satuan: string; jenis_item: string };
type Supplier = { id_pemasok: string; nama_pemasok: string };
type Location = { id_lokasi: string; kode_lokasi: string; nama_lokasi: string };
type Spk = { id_spk: string; jenis_spk: string; id_kavling: string | null; nama_objek: string | null };
type RequestLine = { id_permintaan: string; no_permintaan: string; id_spk: string; id_material: string; nama_material: string; satuan: string; sisa: number };
type StockLine = { id_spk: string; id_material: string; nama_material: string; satuan: string; jumlah: number };

export default function MaterialActionPanel({ materials, suppliers, locations, spks, requestLines, spkStocks, mode }: {
  mode: 'saldo' | 'permintaan' | 'pemakaian'; suppliers: Supplier[]; materials: Material[]; locations: Location[]; spks: Spk[]; requestLines: RequestLine[]; spkStocks: StockLine[];
}) {
  const [issueSelection, setIssueSelection] = useState('');
  const [spkUseSelection, setSpkUseSelection] = useState('');
  const [reconcileSelection, setReconcileSelection] = useState('');
  const bahan = materials.filter((m) => m.jenis_item === 'BAHAN');
  const stockable = materials.filter((m) => m.jenis_item !== 'UPAH');
  const gudang = locations;
  const labelSpk = (spk: Spk) => `${spk.jenis_spk} · ${spk.jenis_spk === 'KAVLING' ? spk.id_kavling : spk.nama_objek}`;

  return <section className="material-actions">
    <div className="kavio-panel-head material-actions-head"><div><h2 className="kavio-panel-title">INPUT TRANSAKSI</h2><div className="kavio-panel-note">Pilih transaksi gudang atau pemakaian material. Tanggal mengikuti hari input.</div></div><span className="kavio-badge">TANPA BACKDATE</span></div>
    {!materials.length && <div className="kavio-panel-body"><div className="kavio-alert warning">Belum ada master material yang dapat dibaca.</div></div>}

    {mode === "saldo" && <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioTransactionModal title="Penerimaan / saldo awal gudang" focusIds={["receipt_material", "receipt_supplier"]}><form action={postMaterialReceipt} className="kavio-form material-form">
      <label className="kavio-field"><span>GUDANG</span><select name="id_lokasi" required defaultValue=""><option value="" disabled>PILIH GUDANG</option>{gudang.map((l)=><option key={l.id_lokasi} value={l.id_lokasi}>{l.kode_lokasi} · {l.nama_lokasi}</option>)}</select></label>
      <label className="kavio-field"><span>MATERIAL</span><select id="receipt_material" name="id_material" required defaultValue=""><option value="" disabled>PILIH MATERIAL</option>{stockable.map((m)=><option key={m.id_material} value={m.id_material}>{m.nama_material} ({m.satuan})</option>)}</select></label>
      <label className="kavio-field"><span>JUMLAH</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field"><span>HARGA SATUAN</span><input name="harga_satuan" type="number" min="0" step="0.01" required /></label>
      <label className="kavio-field"><span>NAMA PEMASOK</span><select id="receipt_supplier" name="id_pemasok" defaultValue=""><option value="">PILIH PEMASOK (PEMBELIAN)</option>{suppliers.map((supplier)=><option key={supplier.id_pemasok} value={supplier.id_pemasok}>{supplier.nama_pemasok}</option>)}</select></label>
      <label className="kavio-field"><span>NOMOR NOTA</span><input name="no_nota" placeholder="Wajib untuk pembelian" /></label>
      <label className="kavio-field material-checkbox"><input name="saldo_awal" type="checkbox" /><span>CATAT SEBAGAI SALDO AWAL</span></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!gudang.length || !stockable.length}>SIMPAN PENERIMAAN</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "permintaan" && <KavioActionGate action="MATERIAL_REQUEST_WRITE"><KavioTransactionModal title="Ajukan kebutuhan material ke SPK" focusIds={["request_spk"]}><form action={createMaterialRequest} className="kavio-form material-form">
      <label className="kavio-field"><span>SPK / OBJEK</span><select id="request_spk" name="id_spk" required defaultValue=""><option value="" disabled>PILIH SPK</option>{spks.map((s)=><option key={s.id_spk} value={s.id_spk}>{labelSpk(s)}</option>)}</select></label>
      <label className="kavio-field"><span>SUMBER LAPORAN</span><select name="sumber_laporan" defaultValue="MANDOR_PELAKSANA"><option value="MANDOR_PELAKSANA">MANDOR / PELAKSANA</option><option value="GUDANG">PETUGAS GUDANG</option></select></label>
      <label className="kavio-field"><span>MATERIAL</span><select name="id_material" required defaultValue=""><option value="" disabled>PILIH MATERIAL</option>{stockable.map((m)=><option key={m.id_material} value={m.id_material}>{m.nama_material} ({m.satuan})</option>)}</select></label>
      <label className="kavio-field"><span>JUMLAH DIMINTA</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!spks.length || !stockable.length}>AJUKAN PERMINTAAN</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "permintaan" && <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioTransactionModal title="Keluarkan gudang untuk memenuhi permintaan" focusIds={["issue_request"]}><form action={issueMaterialToSpk} className="kavio-form material-form">
      <label className="kavio-field"><span>PERMINTAAN · MATERIAL</span><select id="issue_request" value={issueSelection} onChange={(e)=>setIssueSelection(e.target.value)} required><option value="" disabled>PILIH PERMINTAAN</option>{requestLines.map((r)=><option key={`${r.id_permintaan}-${r.id_material}`} value={`${r.id_permintaan}|${r.id_material}`}>{r.no_permintaan} · {r.nama_material} · sisa {r.sisa} {r.satuan}</option>)}</select></label>
      <input type="hidden" name="id_permintaan" value={issueSelection.split('|')[0] ?? ''} /><input type="hidden" name="id_material" value={issueSelection.split('|')[1] ?? ''} />
      <label className="kavio-field"><span>GUDANG</span><select name="id_lokasi" required defaultValue=""><option value="" disabled>PILIH GUDANG</option>{gudang.map((l)=><option key={l.id_lokasi} value={l.id_lokasi}>{l.kode_lokasi} · {l.nama_lokasi}</option>)}</select></label>
      <label className="kavio-field"><span>JUMLAH DIPENUHI</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!requestLines.length || !gudang.length}>POSTING PENGELUARAN</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "pemakaian" && <KavioActionGate action="MATERIAL_USE_WRITE"><KavioTransactionModal title="Pemakaian langsung dari gudang ke SPK" focusIds={["direct_spk"]}><form action={postDirectMaterialUsage} className="kavio-form material-form">
      <label className="kavio-field"><span>SPK / OBJEK</span><select id="direct_spk" name="id_spk" required defaultValue=""><option value="" disabled>PILIH SPK</option>{spks.map((s)=><option key={s.id_spk} value={s.id_spk}>{labelSpk(s)}</option>)}</select></label>
      <label className="kavio-field"><span>GUDANG</span><select name="id_lokasi" required defaultValue=""><option value="" disabled>PILIH GUDANG</option>{gudang.map((l)=><option key={l.id_lokasi} value={l.id_lokasi}>{l.kode_lokasi} · {l.nama_lokasi}</option>)}</select></label>
      <label className="kavio-field"><span>BAHAN</span><select name="id_material" required defaultValue=""><option value="" disabled>PILIH BAHAN</option>{bahan.map((m)=><option key={m.id_material} value={m.id_material}>{m.nama_material} ({m.satuan})</option>)}</select></label>
      <label className="kavio-field"><span>JUMLAH PAKAI</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!spks.length || !gudang.length || !bahan.length}>CATAT PEMAKAIAN</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "pemakaian" && <KavioActionGate action="MATERIAL_USE_WRITE"><KavioTransactionModal title="Pemakaian dari stok SPK" focusIds={["spk_usage_spk"]}><form action={postSpkMaterialUsage} className="kavio-form material-form">
      <label className="kavio-field"><span>STOK SPK · MATERIAL</span><select id="spk_usage_spk" value={spkUseSelection} onChange={(e)=>setSpkUseSelection(e.target.value)} required><option value="" disabled>PILIH STOK SPK</option>{spkStocks.filter((s)=>materials.find((m)=>m.id_material===s.id_material)?.jenis_item==='BAHAN').map((s,i)=><option key={`${s.id_spk}-${s.id_material}-${i}`} value={`${s.id_spk}|${s.id_material}`}>{labelSpk(spks.find((x)=>x.id_spk===s.id_spk) ?? {id_spk:s.id_spk,jenis_spk:'SPK',id_kavling:null,nama_objek:s.id_spk})} · {s.nama_material} ({s.jumlah} {s.satuan})</option>)}</select></label>
      <input type="hidden" name="id_spk" value={spkUseSelection.split('|')[0] ?? ''} /><input type="hidden" name="id_material" value={spkUseSelection.split('|')[1] ?? ''} />
      <label className="kavio-field"><span>JUMLAH PAKAI</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!spkStocks.length}>CATAT PEMAKAIAN SPK</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "pemakaian" && <KavioActionGate action="MATERIAL_USE_WRITE"><KavioTransactionModal title="Pembelian dan pemakaian langsung ke SPK" focusIds={["supplier_spk"]}><form action={postSupplierDirectUsage} className="kavio-form material-form">
      <label className="kavio-field"><span>SPK / OBJEK</span><select id="supplier_spk" name="id_spk" required defaultValue=""><option value="" disabled>PILIH SPK</option>{spks.map((s)=><option key={s.id_spk} value={s.id_spk}>{labelSpk(s)}</option>)}</select></label>
      <label className="kavio-field"><span>PEMASOK</span><select name="id_pemasok" defaultValue="" required><option value="" disabled>PILIH PEMASOK</option>{suppliers.map((supplier)=><option key={supplier.id_pemasok} value={supplier.id_pemasok}>{supplier.nama_pemasok}</option>)}</select></label>
      <label className="kavio-field"><span>NOMOR NOTA</span><input name="no_nota" required /></label>
      <label className="kavio-field"><span>BAHAN</span><select name="id_material" required defaultValue=""><option value="" disabled>PILIH BAHAN</option>{bahan.map((m)=><option key={m.id_material} value={m.id_material}>{m.nama_material} ({m.satuan})</option>)}</select></label>
      <label className="kavio-field"><span>JUMLAH</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field"><span>HARGA SATUAN</span><input name="harga_satuan" type="number" min="0" step="0.01" required /></label>
      <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!spks.length || !bahan.length}>CATAT PEMAKAIAN</button></div>
    </form></KavioTransactionModal></KavioActionGate>}

    {mode === "pemakaian" && <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioTransactionModal title="Rekonsiliasi sisa material SPK" focusIds={["reconcile_spk"]}><form action={reconcileSpkMaterial} className="kavio-form material-form">
      <label className="kavio-field"><span>STOK SPK · MATERIAL</span><select id="reconcile_spk" value={reconcileSelection} onChange={(e)=>setReconcileSelection(e.target.value)} required><option value="" disabled>PILIH ITEM STOK</option>{spkStocks.map((s,i)=><option key={`${s.id_spk}-${s.id_material}-${i}`} value={`${s.id_spk}|${s.id_material}`}>{labelSpk(spks.find((x)=>x.id_spk===s.id_spk) ?? {id_spk:s.id_spk,jenis_spk:'SPK',id_kavling:null,nama_objek:s.id_spk})} · {s.nama_material} ({s.jumlah} {s.satuan})</option>)}</select></label>
      <input type="hidden" name="id_spk" value={reconcileSelection.split('|')[0] ?? ''} /><input type="hidden" name="id_material" value={reconcileSelection.split('|')[1] ?? ''} />
      <label className="kavio-field"><span>JUMLAH DIREKONSILIASI</span><input name="jumlah" type="number" min="0.001" step="0.001" required /></label>
      <label className="kavio-field"><span>TINDAKAN</span><select name="tindakan" defaultValue="KEMBALI_KE_GUDANG"><option value="KEMBALI_KE_GUDANG">KEMBALI KE GUDANG</option><option value="PINDAH_KE_SPK">PINDAH KE SPK LAIN</option><option value="PEMAKAIAN_FINAL">PEMAKAIAN FINAL</option><option value="HILANG_RUSAK">HILANG / RUSAK</option></select></label>
      <label className="kavio-field"><span>GUDANG TUJUAN (UNTUK PENGEMBALIAN)</span><select name="id_lokasi_tujuan" defaultValue=""><option value="">PILIH JIKA DIKEMBALIKAN</option>{gudang.map((l)=><option key={l.id_lokasi} value={l.id_lokasi}>{l.kode_lokasi} · {l.nama_lokasi}</option>)}</select></label>
      <label className="kavio-field"><span>SPK TUJUAN (UNTUK TRANSFER)</span><select name="id_spk_tujuan" defaultValue=""><option value="">PILIH JIKA DIPINDAHKAN</option>{spks.map((s)=><option key={s.id_spk} value={s.id_spk}>{labelSpk(s)}</option>)}</select></label>
      <label className="kavio-field material-wide"><span>ALASAN (WAJIB UNTUK HILANG / RUSAK)</span><input name="alasan" /></label>
      <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!spkStocks.length}>POSTING REKONSILIASI</button></div>
    </form></KavioTransactionModal></KavioActionGate>}
  </section>;
}
