import './material.css';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';
import MaterialActionPanel from './MaterialActionPanel';
import KavioModuleTabs from '../components/KavioModuleTabs';
import { formatKavioMoney } from '../lib/number-format';

type LocationStock = { id_lokasi: string; kode_lokasi: string; nama_lokasi: string; nama_material: string; kategori: string; satuan: string; jenis_item: string; jumlah: number | string; harga_rata_rata: number | string; nilai_persediaan: number | string };
type SpkStock = { id_spk: string; id_material: string; jenis_spk: string; id_kavling: string | null; nama_objek: string | null; nama_material: string; satuan: string; jumlah: number | string; harga_rata_rata: number | string; nilai_stok: number | string };
type Movement = { id_transaksi: string; no_transaksi: string; jenis_transaksi: string; tanggal: string; id_spk: string | null; nama_pemasok: string | null; no_nota: string | null; keterangan: string | null };
type SearchParams = Promise<{ error?: string; success?: string; focus?: string }>;

const currency = { format: formatKavioMoney };
const quantity = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });

export default async function MaterialPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [warehouseResult, spkStockResult, movementResult, materialsResult, locationsResult, spksResult, requestsResult, requestItemsResult, suppliersResult] = await Promise.all([
    supabase.from('v_material_stock_location').select('id_lokasi,kode_lokasi,nama_lokasi,nama_material,kategori,satuan,jenis_item,jumlah,harga_rata_rata,nilai_persediaan').gt('jumlah', 0).order('nama_material').limit(300),
    supabase.from('v_material_stock_spk').select('id_spk,id_material,jenis_spk,id_kavling,nama_objek,nama_material,satuan,jumlah,harga_rata_rata,nilai_stok').gt('jumlah', 0).order('nama_material').limit(300),
    supabase.from('material_transaction').select('id_transaksi,no_transaksi,jenis_transaksi,tanggal,id_spk,nama_pemasok,no_nota,keterangan').order('created_at', { ascending: false }).limit(20),
    supabase.from('master_material').select('id_material,kode_referensi,nama_material,kategori,satuan,jenis_item').eq('status_aktif', true).neq('jenis_item', 'UPAH').order('nama_material'),
    supabase.from('material_location').select('id_lokasi,kode_lokasi,nama_lokasi').eq('status_aktif', true).eq('jenis_lokasi', 'GUDANG').order('nama_lokasi'),
    supabase.from('spk').select('id_spk,jenis_spk,id_kavling,nama_objek').eq('is_active', true).eq('status_spk', 'AKTIF').order('tgl_target_selesai'),
    supabase.from('material_request').select('id_permintaan,no_permintaan,id_spk,status').in('status', ['DIAJUKAN','SEBAGIAN_DIPENUHI']).order('created_at', { ascending: false }),
    supabase.from('material_request_item').select('id_permintaan,id_material,jumlah_diminta,jumlah_dipenuhi'),
    supabase.from('master_pemasok').select('id_pemasok,nama_pemasok').eq('status_aktif', true).order('nama_pemasok'),
  ]);
  const warehouse = (warehouseResult.data ?? []) as LocationStock[];
  const spkStock = (spkStockResult.data ?? []) as SpkStock[];
  const movements = (movementResult.data ?? []) as Movement[];
  const materials = materialsResult.data ?? [];
  const suppliers = suppliersResult.data ?? [];
  const locations = locationsResult.data ?? [];
  const spks = spksResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const requestItems = requestItemsResult.data ?? [];
  const requestLines = requestItems.flatMap((item) => {
    const request = requests.find((row) => row.id_permintaan === item.id_permintaan);
    const material = materials.find((row) => row.id_material === item.id_material);
    const sisa = Number(item.jumlah_diminta) - Number(item.jumlah_dipenuhi);
    return request && material && sisa > 0 ? [{ id_permintaan: request.id_permintaan, no_permintaan: request.no_permintaan, id_spk: request.id_spk, id_material: item.id_material, nama_material: material.nama_material, satuan: material.satuan, sisa }] : [];
  });
  const error = params.error ?? warehouseResult.error?.message ?? spkStockResult.error?.message ?? movementResult.error?.message ?? materialsResult.error?.message ?? locationsResult.error?.message ?? spksResult.error?.message ?? requestsResult.error?.message ?? requestItemsResult.error?.message ?? suppliersResult.error?.message;
  const warehouseValue = warehouse.reduce((sum, row) => sum + Number(row.nilai_persediaan ?? 0), 0);
  const spkValue = spkStock.reduce((sum, row) => sum + Number(row.nilai_stok ?? 0), 0);

  return <main className="material-page">
    {error && <div className="kavio-alert error">{error}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="material-summary">
      <Summary label="PERMINTAAN TERBUKA" value={String(requests.length)} detail="Kebutuhan material belum selesai" />
      <Summary label="ITEM DI GUDANG" value={String(warehouse.length)} detail={currency.format(warehouseValue)} />
      <Summary label="ITEM DI SPK" value={String(spkStock.length)} detail={currency.format(spkValue)} />
      <Summary label="TRANSAKSI TERBARU" value={String(movements.length)} detail="Maksimal 20 transaksi" />
    </section>
    <KavioModuleTabs tabs={[
      {id:'saldo',label:'Saldo Gudang',focusIds:['receipt_material','receipt_supplier']},
      {id:'permintaan',label:'Permintaan & Pengeluaran',focusIds:['request_spk','issue_request']},
      {id:'pemakaian',label:'Pemakaian & Rekonsiliasi',focusIds:['direct_spk','spk_usage_spk','supplier_spk','reconcile_spk']},
      {id:'mutasi',label:'Riwayat Transaksi'},
    ]}>
      <div className="kavio-module-content">
        <section className="kavio-panel"><MaterialActionPanel mode="saldo" materials={materials} suppliers={suppliers} locations={locations} spks={spks} requestLines={requestLines} spkStocks={spkStock.map((row)=>({id_spk:row.id_spk,id_material:row.id_material,nama_material:row.nama_material,satuan:row.satuan,jumlah:Number(row.jumlah)}))} /></section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">SALDO GUDANG</h2><div className="kavio-panel-note">Saldo dan nilai berdasarkan harga rata-rata tertimbang.</div></div><span className="kavio-badge">{warehouse.length} BARIS</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>LOKASI</th><th>MATERIAL</th><th>JENIS</th><th>STOK</th><th>HARGA RATA-RATA</th><th>NILAI</th></tr></thead><tbody>{warehouse.map((row, i) => <tr key={`${row.id_lokasi}-${row.nama_material}-${i}`}><td>{row.kode_lokasi} · {row.nama_lokasi}</td><td>{row.nama_material}<small className="material-subtext">{row.kategori}</small></td><td>{row.jenis_item.replaceAll('_', ' ')}</td><td className="text-right">{quantity.format(Number(row.jumlah))} {row.satuan}</td><td className="text-right">{currency.format(Number(row.harga_rata_rata))}</td><td className="text-right">{currency.format(Number(row.nilai_persediaan))}</td></tr>)}{!warehouse.length && <tr><td colSpan={6} className="kavio-empty">BELUM ADA SALDO GUDANG. CATAT PENERIMAAN ATAU SALDO AWAL UNTUK MEMBENTUK STOK.</td></tr>}</tbody></table></div>
    </section>
      </div>
      <div className="kavio-module-content">
        <section className="kavio-panel"><MaterialActionPanel mode="permintaan" materials={materials} suppliers={suppliers} locations={locations} spks={spks} requestLines={requestLines} spkStocks={spkStock.map((row)=>({id_spk:row.id_spk,id_material:row.id_material,nama_material:row.nama_material,satuan:row.satuan,jumlah:Number(row.jumlah)}))} /></section>
<section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">PERMINTAAN MATERIAL TERBUKA</h2><span className="kavio-badge">{requestLines.length} ITEM</span></div><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>PERMINTAAN</th><th>OBJEK SPK</th><th>MATERIAL</th><th className="text-right">SISA KEBUTUHAN</th></tr></thead><tbody>{requestLines.map((row)=><tr key={`${row.id_permintaan}-${row.id_material}`}><td>{row.no_permintaan}</td><td>{spks.find((spk)=>spk.id_spk===row.id_spk)?.id_kavling || spks.find((spk)=>spk.id_spk===row.id_spk)?.nama_objek || 'SPK'}</td><td>{row.nama_material}</td><td className="text-right">{quantity.format(row.sisa)} {row.satuan}</td></tr>)}{!requestLines.length&&<tr><td colSpan={4} className="kavio-empty">TIDAK ADA PERMINTAAN TERBUKA.</td></tr>}</tbody></table></div></section>
      </div>
      <div className="kavio-module-content">
        <section className="kavio-panel"><MaterialActionPanel mode="pemakaian" materials={materials} suppliers={suppliers} locations={locations} spks={spks} requestLines={requestLines} spkStocks={spkStock.map((row)=>({id_spk:row.id_spk,id_material:row.id_material,nama_material:row.nama_material,satuan:row.satuan,jumlah:Number(row.jumlah)}))} /></section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">STOK MATERIAL PER SPK</h2><div className="kavio-panel-note">Stok yang sudah dialokasikan ke objek pekerjaan dan perlu dipakai atau direkonsiliasi sebelum SPK ditutup.</div></div><span className="kavio-badge">{spkStock.length} BARIS</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>OBJEK</th><th>MATERIAL</th><th>STOK</th><th>HARGA RATA-RATA</th><th>NILAI</th></tr></thead><tbody>{spkStock.map((row, i) => <tr key={`${row.id_spk}-${row.nama_material}-${i}`}><td>{row.jenis_spk} · {row.jenis_spk === 'KAVLING' ? row.id_kavling : row.nama_objek}</td><td>{row.nama_material}</td><td className="text-right">{quantity.format(Number(row.jumlah))} {row.satuan}</td><td className="text-right">{currency.format(Number(row.harga_rata_rata))}</td><td className="text-right">{currency.format(Number(row.nilai_stok))}</td></tr>)}{!spkStock.length && <tr><td colSpan={5} className="kavio-empty">TIDAK ADA SISA STOK PADA SPK.</td></tr>}</tbody></table></div>
    </section>
      </div>
      <div className="kavio-module-content">
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">TRANSAKSI TERBARU</h2><div className="kavio-panel-note">Jejak transaksi stok yang sudah diposting.</div></div><span className="kavio-badge">20 TERAKHIR</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>TANGGAL</th><th>NOMOR</th><th>JENIS</th><th>PEMASOK / NOTA</th><th>KETERANGAN</th></tr></thead><tbody>{movements.map((row) => <tr key={row.id_transaksi}><td>{formatKavioDate(row.tanggal)}</td><td>{row.no_transaksi}</td><td>{row.jenis_transaksi.replaceAll('_', ' ')}</td><td>{row.nama_pemasok || '—'}{row.no_nota ? <small className="material-subtext">{row.no_nota}</small> : null}</td><td>{row.keterangan || '—'}</td></tr>)}{!movements.length && <tr><td colSpan={5} className="kavio-empty">BELUM ADA TRANSAKSI MATERIAL.</td></tr>}</tbody></table></div>
    </section>
      </div>
    </KavioModuleTabs>
  </main>;
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="kavio-kpi material-summary-card"><div className="kavio-kpi-label">{label}</div><div className="kavio-kpi-value">{value}</div><div className="material-summary-detail">{detail}</div></div>;
}
