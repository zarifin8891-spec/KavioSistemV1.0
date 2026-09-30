import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import { deactivateSales } from './actions';
import { formatKavioDate } from '../../lib/date-format';
import SalesCreatePanel from './SalesCreatePanel';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import { formatKavioMoney } from '../../lib/number-format';

const PAGE_SIZE = 25;

type SearchParams = Promise<{ error?: string; success?: string; status?: string; tipe?: string; q?: string; page?: string }>;
type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean; harga_jual: number | string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };
type Notaris = { id_notaris: string; nama_notaris: string };
type SalesListRow = {
  id_sales:string;
  id_kavling:string;
  nama_konsumen:string;
  hp_konsumen:string|null;
  status_sales:string;
  jenis_pembayaran:string;
  id_bank:string|null;
  harga_jual:number|string|null;
  tgl_booking:string|null;
  status_aktif:boolean;
  created_at:string;
  id_tipe:string|null;
  nama_tipe:string|null;
  nama_bank:string|null;
  harga_jual_dasar:number|string|null;
  total_biaya_tambahan:number|string|null;
  total_harga:number|string|null;
  filtered_count:number|string;
};
type SalesKpi = { total_sales:number|string; booking:number|string; dp:number|string; proses_kpr:number|string; akad:number|string; batal:number|string; aktif:number|string };
type SalesLock = { id_kavling:string; status_sales:string; status_aktif:boolean };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const filterStatus = params.status ?? '';
  const filterTipe = params.tipe ?? '';
  const filterQuery = (params.q ?? '').trim();
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [kavlingRes, tipeRes, bankRes, notarisRes, pageRes, kpiRes, lockRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_kavling,status_aktif,harga_jual').eq('status_aktif',true).order('id_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe'),
    supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).order('nama_bank'),
    supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
    supabase.rpc('kavio_sales_list_page', {
      p_status: filterStatus || null,
      p_tipe: filterTipe || null,
      p_query: filterQuery || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    supabase.rpc('kavio_sales_kpi'),
    supabase.from('sales').select('id_kavling,status_sales,status_aktif').or('status_aktif.eq.true,status_sales.eq.AKAD'),
  ]);

  const kavlings=(kavlingRes.data??[]) as Kavling[];
  const types=(tipeRes.data??[]) as Tipe[];
  const banks=(bankRes.data??[]) as Bank[];
  const notaries=(notarisRes.data??[]) as Notaris[];
  const salesRows=(pageRes.data??[]) as SalesListRow[];
  const kpi=(kpiRes.data?.[0]??{ total_sales:0, booking:0, dp:0, proses_kpr:0, akad:0, batal:0, aktif:0 }) as SalesKpi;
  const locked=(lockRes.data??[]) as SalesLock[];

  const activeSalesKavlings=new Set(locked.filter(r=>r.status_aktif).map(r=>r.id_kavling));
  const akadSalesKavlings=new Set(locked.filter(r=>r.status_sales==='AKAD').map(r=>r.id_kavling));
  const saleable=kavlings.filter(r=>['AVAILABLE','BUILDING','READY_STOCK'].includes(r.status_kavling)&&!activeSalesKavlings.has(r.id_kavling)&&!akadSalesKavlings.has(r.id_kavling));

  const filteredTotal = salesRows.length ? Number(salesRows[0].filtered_count ?? 0) : 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filterStatus) query.set('status', filterStatus);
    if (filterTipe) query.set('tipe', filterTipe);
    if (filterQuery) query.set('q', filterQuery);
    if (page > 1) query.set('page', String(page));
    const suffix = query.toString();
    return suffix ? `/master/sales?${suffix}` : '/master/sales';
  };

  const error=params.error??kavlingRes.error?.message??tipeRes.error?.message??bankRes.error?.message??notarisRes.error?.message??pageRes.error?.message??kpiRes.error?.message??lockRes.error?.message;

  return <main className="sales-page">
    <section className="sales-content">
      {error&&<div className="kavio-alert error">{error}</div>}
      {params.success&&<div className="kavio-alert success">{params.success}</div>}

      <div className="sales-summary-grid">
        <Summary label="TOTAL SALES" value={Number(kpi.total_sales)} />
        <Summary label="BOOKING" value={Number(kpi.booking)} />
        <Summary label="UANG MUKA" value={Number(kpi.dp)} />
        <Summary label="PROSES KPR" value={Number(kpi.proses_kpr)} />
        <Summary label="AKAD" value={Number(kpi.akad)} />
        <Summary label="BATAL" value={Number(kpi.batal)} />
      </div>

      <section className="kavio-panel sales-list-panel">
        <div className="kavio-panel-head sales-list-head">
          <div><h2 className="kavio-panel-title">DAFTAR SALES</h2><div className="kavio-panel-note">Satu kavling hanya memiliki satu Sales aktif. Detail konsumen tersedia melalui tombol DETAIL.</div></div>
          <div id="sales-add-action" className="sales-add-action" aria-label="Aksi tambah sales" />
        </div>

        <form method="get" className="sales-filter-row">
          <select name="status" aria-label="Filter status" defaultValue={filterStatus}><option value="">SEMUA STATUS</option><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select>
          <select name="tipe" aria-label="Filter tipe" defaultValue={filterTipe}><option value="">SEMUA TIPE</option>{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select>
          <input name="q" aria-label="Cari konsumen" defaultValue={params.q ?? ''} placeholder="CARI NAMA / KAVLING / HP..." />
          <button type="submit" className="kavio-button sales-filter-submit">FILTER</button>
          {(filterStatus || filterTipe || filterQuery) ? <Link href="/master/sales" className="kavio-button secondary sales-filter-reset">RESET</Link> : null}
        </form>

        <div className="kavio-table-wrap">
          <table className="kavio-table sales-table">
            <thead><tr><th>NO</th><th>TANGGAL</th><th>KAVLING</th><th>NAMA KONSUMEN</th><th>HP</th><th>TIPE</th><th>HARGA DASAR</th><th>BIAYA</th><th>TOTAL HARGA</th><th>JENIS BAYAR</th><th>BANK</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>{salesRows.map((row,index)=><tr key={row.id_sales}>
              <td className="sales-center">{offset+index+1}</td>
              <td>{row.tgl_booking ? formatKavioDate(row.tgl_booking) : '—'}</td>
              <td className="sales-highlight"><Link href={`/master/sales/detail?id=${row.id_sales}`}>{row.id_kavling}</Link></td>
              <td className="sales-highlight">{row.nama_konsumen}</td>
              <td>{row.hp_konsumen??'—'}</td>
              <td>{row.nama_tipe??'—'}</td>
              <td className="kavio-money">{formatKavioMoney(row.harga_jual_dasar ?? row.harga_jual)}</td>
              <td className="kavio-money">{formatKavioMoney(row.total_biaya_tambahan ?? 0)}</td>
              <td className="kavio-money">{formatKavioMoney(row.total_harga ?? row.harga_jual)}</td>
              <td>{row.jenis_pembayaran??'—'}</td>
              <td>{row.jenis_pembayaran==='KPR'?(row.nama_bank??'—'):'—'}</td>
              <td><span className={`sales-status-badge ${row.status_sales.toLowerCase()}`}>{statusLabel(row.status_sales)}</span></td>
              <td><div className="sales-actions">{row.status_aktif?<><Link href={`/master/sales/detail?id=${row.id_sales}`} className="kavio-button secondary">DETAIL</Link><KavioConfirmAction action={deactivateSales} hidden={{ id_sales: row.id_sales }} label="TUTUP" confirmMessage={'Konfirmasi: Sales ' + row.nama_konsumen + ' untuk kavling ' + row.id_kavling + ' akan ditutup. Status Sales akan menjadi ' + (row.status_sales === 'AKAD' ? 'AKAD (tidak aktif)' : 'BATAL') + '. Lanjutkan?'} /></>:<span>—</span>}</div></td>
            </tr>)}{!salesRows.length&&<tr><td colSpan={13} className="kavio-empty">BELUM ADA DATA SALES.</td></tr>}</tbody>
          </table>
        </div>
        <div className="sales-table-foot">
          <span>MENAMPILKAN {salesRows.length} DARI {filteredTotal} DATA · SALES AKTIF: {Number(kpi.aktif)}</span>
          <div className="kavio-pagination" aria-label="Navigasi halaman Sales">
            {hasPrev ? <Link href={pageHref(currentPage-1)} className="kavio-button secondary">← SEBELUMNYA</Link> : <span />}
            <span>HALAMAN {currentPage} / {totalPages}</span>
            {hasNext ? <Link href={pageHref(currentPage+1)} className="kavio-button secondary">BERIKUTNYA →</Link> : <span />}
          </div>
        </div>
      </section>
      <SalesCreatePanel kavlings={saleable} tipeMap={types} banks={banks} notaries={notaries} triggerTargetId="sales-add-action" />
    </section>
  </main>;
}

function Summary({label,value}:{label:string;value:number}){return <div className="kavio-kpi sales-summary-card"><div className="kavio-kpi-label sales-summary-label">{label}</div><div className="kavio-kpi-value sales-summary-value">{value}</div></div>}function statusLabel(status:string){return status==='PROSES_KPR'?'PROSES KPR':status==='DP'?'UANG MUKA':status}
