import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { deactivateSales } from './actions';
import SalesCreatePanel from './SalesCreatePanel';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };
type Notaris = { id_notaris: string; nama_notaris: string };
type Sales = { id_sales:string; id_kavling:string; nama_konsumen:string; status_sales:string; jenis_pembayaran:string; id_bank:string|null; id_notaris:string|null; harga_jual:number|string|null; tgl_booking:string|null; target_akad:string|null; tgl_akad:string|null; status_aktif:boolean; created_at:string };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data:{user} } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [kavlingRes, tipeRes, bankRes, notarisRes, salesRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_kavling,status_aktif').eq('status_aktif',true).order('id_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe').eq('status_aktif',true).order('nama_tipe'),
    supabase.from('master_bank').select('id_bank,nama_bank').eq('status_aktif',true).order('nama_bank'),
    supabase.from('master_notaris').select('id_notaris,nama_notaris').eq('status_aktif',true).order('nama_notaris'),
    supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,status_sales,jenis_pembayaran,id_bank,id_notaris,harga_jual,tgl_booking,target_akad,tgl_akad,status_aktif,created_at').order('created_at',{ascending:false}),
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
  const saleable=kavlings.filter(r=>['AVAILABLE','BUILDING','READY_STOCK'].includes(r.status_kavling));
  const error=params.error??kavlingRes.error?.message??tipeRes.error?.message??bankRes.error?.message??notarisRes.error?.message??salesRes.error?.message;

  return <main className="sales-page">
    <section className="sales-content">
      <div className="sales-title"><div><h1>SALES MANAGEMENT</h1><p>KELOLA DATA KONSUMEN, STATUS PENJUALAN, DAN STATUS PEMBAYARAN.</p></div></div>
      {error&&<div className="simple-alert error">{error}</div>}
      {params.success&&<div className="simple-alert success">{params.success}</div>}
      <div style={summaryGrid}>
        <Summary label="TOTAL AKTIF" value={active.length} />
        <Summary label="BOOKING" value={count('BOOKING')} />
        <Summary label="DP" value={count('DP')} />
        <Summary label="PROSES KPR" value={count('PROSES_KPR')} />
        <Summary label="AKAD" value={count('AKAD')} />
      </div>

      <section className="sales-module-card">
        <div style={filterRow}>
          <select style={filterInput} defaultValue=""><option value="">SEMUA STATUS</option><option value="BOOKING">BOOKING</option><option value="DP">DP</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select>
          <select style={filterInput} defaultValue=""><option value="">SEMUA TIPE</option>{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe.toUpperCase()}</option>)}</select>
          <input style={{ ...filterInput, minWidth: 250 }} placeholder="CARI NAMA KONSUMEN..." />
          <SalesCreatePanel kavlings={saleable} tipeMap={types} banks={banks} notaries={notaries} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead><tr>
              <th style={th}>NO</th><th style={th}>TANGGAL</th><th style={th}>KAVLING</th><th style={th}>NAMA KONSUMEN</th><th style={th}>TIPE</th><th style={th}>HARGA</th><th style={th}>JENIS BAYAR</th><th style={th}>BANK</th><th style={th}>STATUS</th><th style={th}>AKSI</th>
            </tr></thead>
            <tbody>{sales.map((row,index)=>{const kavling=kavlings.find(item=>item.id_kavling===row.id_kavling);return <tr key={row.id_sales}>
              <td style={tdCenter}>{index+1}</td><td style={td}>{row.tgl_booking??'—'}</td><td style={tdStrong}><Link href={`/master/sales/detail?id=${row.id_sales}`} style={salesLink}>{row.id_kavling}</Link></td><td style={tdStrong}>{row.nama_konsumen}</td><td style={td}>{typeMap.get(kavling?.id_tipe??'')??'—'}</td><td style={td}>{formatCurrency(row.harga_jual)}</td><td style={td}>{row.jenis_pembayaran??'—'}</td><td style={td}>{row.jenis_pembayaran==='KPR'?(bankMap.get(row.id_bank??'')??'—'):'—'}</td><td style={td}><span style={salesBadge(row.status_sales)}>{statusLabel(row.status_sales)}</span></td><td style={td}>{row.status_aktif?<div style={actionsCell}><Link href={`/master/sales/detail?id=${row.id_sales}`} style={detailButton}>DETAIL</Link><form action={deactivateSales}><input type="hidden" name="id_sales" value={row.id_sales}/><button type="submit" style={detailButton}>TUTUP</button></form></div>:<span style={{color:'#8D815F'}}>—</span>}</td>
            </tr>})}{!sales.length&&<tr><td colSpan={10} style={empty}>BELUM ADA DATA SALES.</td></tr>}</tbody>
          </table>
        </div>
        <div style={tableFoot}><span>MENAMPILKAN {sales.length} DATA</span><span style={footNote}>SALES AKTIF: {active.length}</span></div>
      </section>
    </section>
  </main>;
}

function Summary({label,value}:{label:string;value:number}){return <div style={summaryCard}><div style={summaryLabel}>{label}</div><div style={summaryValue}>{value}</div></div>}
function formatCurrency(value:number|string|null){const n=Number(value);return Number.isFinite(n)&&n>0?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n):'—'}
function statusLabel(status:string){return status==='PROSES_KPR'?'PROSES KPR':status}
function salesBadge(status:string){const tone=status==='BATAL'?['rgba(248,113,113,.14)','#FCA5A5','#B91C1C']:status==='AKAD'?['rgba(134,239,172,.14)','#BBF7D0','#15803D']:status==='DP'?['rgba(232,204,122,.20)','#172B43','#D8B45A']:['rgba(92,171,239,.18)','#DCEEFF','#4D91C8'];return {display:'inline-flex',padding:'6px 11px',borderRadius:7,fontSize:11,fontWeight:900,background:tone[0],color:tone[1],border:`1px solid ${tone[2]}`,whiteSpace:'nowrap' as const}}
const summaryGrid={display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:12,marginBottom:18};
const summaryCard={padding:'13px 15px',border:'1px solid rgba(216,180,90,.30)',borderRadius:11,background:'linear-gradient(180deg,#173452,#0D2948)'};
const summaryLabel={color:'#C9BC99',fontSize:9,fontWeight:900,letterSpacing:.8};
const summaryValue={marginTop:4,color:'#F0D48A',fontSize:23,fontWeight:900};
const filterRow={display:'flex',gap:10,padding:'13px 18px',background:'rgba(4,24,47,.55)',borderBottom:'1px solid rgba(216,180,90,.16)',alignItems:'center'};
const filterInput={minWidth:155,padding:'9px 12px',borderRadius:8,border:'1px solid rgba(232,204,122,.40)',background:'#314A68',color:'#F7F3E8',outline:'none',fontSize:12};
const table={width:'100%',borderCollapse:'collapse' as const,fontSize:12,background:'rgba(13,41,72,.78)'};
const th={padding:'12px 13px',background:'linear-gradient(180deg,#153654,#102E4D)',color:'#F0D48A',borderBottom:'1px solid #A98235',textAlign:'left' as const,whiteSpace:'nowrap'};
const td={padding:'11px 13px',color:'#F7F3E8',borderBottom:'1px solid rgba(216,180,90,.12)',verticalAlign:'middle' as const};
const tdStrong={...td,fontWeight:900,color:'#F0D48A'};
const tdCenter={...td,textAlign:'center' as const,fontWeight:800};
const salesLink={color:'#F0D48A',textDecoration:'none',fontWeight:900};
const actionsCell={display:'flex',alignItems:'center',gap:7};
const detailButton={padding:'6px 9px',borderRadius:7,border:'1px solid #B8943F',background:'#E8CC7A',color:'#172B43',textDecoration:'none',fontSize:10,fontWeight:900,cursor:'pointer'};
const tableFoot={padding:'13px 18px',display:'flex',justifyContent:'space-between',color:'#E5DDCC',fontSize:11};
const footNote={color:'#BFAF83'};
const empty={padding:28,textAlign:'center' as const,color:'#C9BC99'};
