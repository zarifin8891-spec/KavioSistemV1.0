import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { deactivateSales } from './actions';
import SalesCreatePanel from './SalesCreatePanel';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean; harga_jual: number | string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };
type Notaris = { id_notaris: string; nama_notaris: string };
type Sales = { id_sales:string; id_kavling:string; nama_konsumen:string; alamat_konsumen:string|null; hp_konsumen:string|null; status_sales:string; jenis_pembayaran:string; id_bank:string|null; id_notaris:string|null; harga_jual:number|string|null; tgl_booking:string|null; target_akad:string|null; tgl_akad:string|null; status_aktif:boolean; created_at:string };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [kavlingRes, tipeRes, bankRes, notarisRes, salesRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_kavling,status_aktif,harga_jual').eq('status_aktif',true).order('id_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe'),
    supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).order('nama_bank'),
    supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
    supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif,created_at').order('created_at',{ascending:false}),
  ]);

  const kavlings=(kavlingRes.data??[]) as Kavling[];
  const types=(tipeRes.data??[]) as Tipe[];
  const banks=(bankRes.data??[]) as Bank[];
  const notaries=(notarisRes.data??[]) as Notaris[];
  const sales=(salesRes.data??[]) as Sales[];
  const typeMap=new Map(types.map(r=>[r.id_tipe,r.nama_tipe]));
  const bankMap=new Map(banks.map(r=>[r.id_bank,r.nama_bank]));
  const active=sales.filter(r=>r.status_aktif);
  const count=(s:string)=>active.filter(r=>r.status_sales===s).length;
  const activeSalesKavlings=new Set(active.map(r=>r.id_kavling));
  const saleable=kavlings.filter(r=>['AVAILABLE','BUILDING','READY_STOCK'].includes(r.status_kavling)&&!activeSalesKavlings.has(r.id_kavling));
  const error=params.error??kavlingRes.error?.message??tipeRes.error?.message??bankRes.error?.message??notarisRes.error?.message??salesRes.error?.message;

  return <main className="sales-page">
    <section className="sales-content">
      {error&&<div className="kavio-alert error">{error}</div>}
      {params.success&&<div className="kavio-alert success">{params.success}</div>}

      <div className="sales-summary-grid">
        <Summary label="TOTAL AKTIF" value={active.length} />
        <Summary label="BOOKING" value={count('BOOKING')} />
        <Summary label="UANG MUKA" value={count('DP')} />
        <Summary label="PROSES KPR" value={count('PROSES_KPR')} />
        <Summary label="AKAD" value={count('AKAD')} />
      </div>

      <section className="kavio-panel sales-list-panel">
        <div className="kavio-panel-head sales-list-head">
          <div><h2 className="kavio-panel-title">DAFTAR SALES</h2><div className="kavio-panel-note">Satu kavling hanya memiliki satu Sales aktif. Detail konsumen tersedia melalui tombol DETAIL.</div></div>
          <span className="kavio-badge">{sales.length} DATA</span>
        </div>

        <div className="sales-filter-row">
          <select aria-label="Filter status" defaultValue=""><option value="">SEMUA STATUS</option><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select>
          <select aria-label="Filter tipe" defaultValue=""><option value="">SEMUA TIPE</option>{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select>
          <input aria-label="Cari konsumen" placeholder="CARI NAMA KONSUMEN..." />
        </div>

        <div className="kavio-table-wrap">
          <table className="kavio-table sales-table">
            <thead><tr><th>NO</th><th>TANGGAL</th><th>KAVLING</th><th>NAMA KONSUMEN</th><th>HP</th><th>TIPE</th><th>HARGA</th><th>JENIS BAYAR</th><th>BANK</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>{sales.map((row,index)=>{const kavling=kavlings.find(item=>item.id_kavling===row.id_kavling);return <tr key={row.id_sales}>
              <td className="sales-center">{index+1}</td>
              <td>{row.tgl_booking??'—'}</td>
              <td className="sales-highlight"><Link href={`/master/sales/detail?id=${row.id_sales}`}>{row.id_kavling}</Link></td>
              <td className="sales-highlight">{row.nama_konsumen}</td>
              <td>{row.hp_konsumen??'—'}</td>
              <td>{typeMap.get(kavling?.id_tipe??'')??'—'}</td>
              <td>{formatCurrency(row.harga_jual)}</td>
              <td>{row.jenis_pembayaran??'—'}</td>
              <td>{row.jenis_pembayaran==='KPR'?(bankMap.get(row.id_bank??'')??'—'):'—'}</td>
              <td><span className={`sales-status-badge ${row.status_sales.toLowerCase()}`}>{statusLabel(row.status_sales)}</span></td>
              <td><div className="sales-actions">{row.status_aktif?<><Link href={`/master/sales/detail?id=${row.id_sales}`} className="kavio-button secondary">DETAIL</Link><form action={deactivateSales}><input type="hidden" name="id_sales" value={row.id_sales}/><button type="submit" className="kavio-button secondary">TUTUP</button></form></>:<span>—</span>}</div></td>
            </tr>})}{!sales.length&&<tr><td colSpan={11} className="kavio-empty">BELUM ADA DATA SALES.</td></tr>}</tbody>
          </table>
        </div>
        <div className="sales-table-foot"><span>MENAMPILKAN {sales.length} DATA</span><span>SALES AKTIF: {active.length}</span></div>
      </section>
      <SalesCreatePanel kavlings={saleable} tipeMap={types} banks={banks} notaries={notaries} />
    </section>
  </main>;
}

function Summary({label,value}:{label:string;value:number}){return <div className="sales-summary-card"><div className="sales-summary-label">{label}</div><div className="sales-summary-value">{value}</div></div>}
function formatCurrency(value:number|string|null){const n=Number(value);return Number.isFinite(n)&&n>0?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n):'—'}
function statusLabel(status:string){return status==='PROSES_KPR'?'PROSES KPR':status==='DP'?'UANG MUKA':status}
