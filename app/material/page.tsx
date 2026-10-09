import './material.css';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';

type LocationStock = { id_lokasi: string; kode_lokasi: string; nama_lokasi: string; nama_material: string; kategori: string; satuan: string; jenis_item: string; jumlah: number | string; harga_rata_rata: number | string; nilai_persediaan: number | string };
type SpkStock = { id_spk: string; jenis_spk: string; id_kavling: string | null; nama_objek: string | null; nama_material: string; satuan: string; jumlah: number | string; harga_rata_rata: number | string; nilai_stok: number | string };
type Movement = { id_transaksi: string; no_transaksi: string; jenis_transaksi: string; tanggal: string; id_spk: string | null; nama_pemasok: string | null; no_nota: string | null; keterangan: string | null };

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });

export default async function MaterialPage() {
  const supabase = await createClient();
  const [warehouseResult, spkStockResult, movementResult] = await Promise.all([
    supabase.from('v_material_stock_location').select('id_lokasi,kode_lokasi,nama_lokasi,nama_material,kategori,satuan,jenis_item,jumlah,harga_rata_rata,nilai_persediaan').gt('jumlah', 0).order('nama_material').limit(300),
    supabase.from('v_material_stock_spk').select('id_spk,jenis_spk,id_kavling,nama_objek,nama_material,satuan,jumlah,harga_rata_rata,nilai_stok').gt('jumlah', 0).order('nama_material').limit(300),
    supabase.from('material_transaction').select('id_transaksi,no_transaksi,jenis_transaksi,tanggal,id_spk,nama_pemasok,no_nota,keterangan').order('created_at', { ascending: false }).limit(20),
  ]);
  const warehouse = (warehouseResult.data ?? []) as LocationStock[];
  const spkStock = (spkStockResult.data ?? []) as SpkStock[];
  const movements = (movementResult.data ?? []) as Movement[];
  const error = warehouseResult.error?.message ?? spkStockResult.error?.message ?? movementResult.error?.message;
  const warehouseValue = warehouse.reduce((sum, row) => sum + Number(row.nilai_persediaan ?? 0), 0);
  const spkValue = spkStock.reduce((sum, row) => sum + Number(row.nilai_stok ?? 0), 0);

  return <main className="material-page">
    {error && <div className="kavio-alert error">Data Material Control belum tersedia atau tidak dapat dibaca. Pastikan migrasi V2 sudah diterapkan pada database proyek. Detail: {error}</div>}
    <section className="material-summary">
      <Summary label="ITEM DI GUDANG" value={String(warehouse.length)} detail={currency.format(warehouseValue)} />
      <Summary label="ITEM DI SPK" value={String(spkStock.length)} detail={currency.format(spkValue)} />
      <Summary label="TRANSAKSI TERBARU" value={String(movements.length)} detail="Maksimal 20 transaksi" />
    </section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">SALDO GUDANG</h2><div className="kavio-panel-note">Saldo dan nilai berdasarkan harga rata-rata tertimbang.</div></div><span className="kavio-badge">{warehouse.length} BARIS</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>LOKASI</th><th>MATERIAL</th><th>JENIS</th><th>STOK</th><th>HARGA RATA-RATA</th><th>NILAI</th></tr></thead><tbody>{warehouse.map((row, i) => <tr key={`${row.id_lokasi}-${row.nama_material}-${i}`}><td>{row.kode_lokasi} · {row.nama_lokasi}</td><td>{row.nama_material}<small className="material-subtext">{row.kategori}</small></td><td>{row.jenis_item.replaceAll('_', ' ')}</td><td>{quantity.format(Number(row.jumlah))} {row.satuan}</td><td>{currency.format(Number(row.harga_rata_rata))}</td><td>{currency.format(Number(row.nilai_persediaan))}</td></tr>)}{!warehouse.length && <tr><td colSpan={6} className="kavio-empty">BELUM ADA SALDO GUDANG.</td></tr>}</tbody></table></div>
    </section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">STOK MATERIAL PER SPK</h2><div className="kavio-panel-note">Stok yang sudah dialokasikan ke objek pekerjaan dan perlu dipakai atau direkonsiliasi sebelum SPK ditutup.</div></div><span className="kavio-badge">{spkStock.length} BARIS</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>OBJEK</th><th>MATERIAL</th><th>STOK</th><th>HARGA RATA-RATA</th><th>NILAI</th></tr></thead><tbody>{spkStock.map((row, i) => <tr key={`${row.id_spk}-${row.nama_material}-${i}`}><td>{row.jenis_spk} · {row.jenis_spk === 'KAVLING' ? row.id_kavling : row.nama_objek}</td><td>{row.nama_material}</td><td>{quantity.format(Number(row.jumlah))} {row.satuan}</td><td>{currency.format(Number(row.harga_rata_rata))}</td><td>{currency.format(Number(row.nilai_stok))}</td></tr>)}{!spkStock.length && <tr><td colSpan={5} className="kavio-empty">TIDAK ADA SISA STOK PADA SPK.</td></tr>}</tbody></table></div>
    </section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">TRANSAKSI TERBARU</h2><div className="kavio-panel-note">Jejak transaksi stok yang sudah diposting.</div></div><span className="kavio-badge">20 TERAKHIR</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>TANGGAL</th><th>NOMOR</th><th>JENIS</th><th>PEMASOK / NOTA</th><th>KETERANGAN</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id_transaksi}><td>{formatKavioDate(row.tanggal)}</td><td>{row.no_transaksi}</td><td>{row.jenis_transaksi.replaceAll('_', ' ')}</td><td>{row.nama_pemasok || '—'}{row.no_nota ? <small className="material-subtext">{row.no_nota}</small> : null}</td><td>{row.keterangan || '—'}</td></tr>)}{!movements.length && <tr><td colSpan={5} className="kavio-empty">BELUM ADA TRANSAKSI MATERIAL.</td></tr>}</tbody></table></div>
    </section>
  </main>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="kavio-kpi material-summary-card"><div className="kavio-kpi-label">{label}</div><div className="kavio-kpi-value">{value}</div><div className="material-summary-detail">{detail}</div></div>;
}
