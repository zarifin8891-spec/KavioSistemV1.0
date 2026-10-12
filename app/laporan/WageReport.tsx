import KavioReportActions from '../components/KavioReportActions';
import WagePayments from './upah/WagePayments';
import KavioFilterBar,{KavioFilterField,KavioFilterActions} from '../components/KavioFilterBar';
import Link from 'next/link';
import KavioReportHeading from '../components/KavioReportHeading';
import {createClient} from '../../lib/supabase/server';
import {formatKavioDate} from '../lib/date-format';
import KavioPrintButton from '../components/KavioPrintButton';
type Params=Record<string,string|string[]|undefined>;
type Row={id_spk:string;jenis_spk:string;id_kavling:string|null;nama_objek:string|null;id_detail:string;id_mandor:string;nama_mandor:string;nama_pekerjaan:string;nama_kategori:string;volume:number;satuan:string;progress_periode:number;progress_akumulasi:number;retensi:number;upah_item:number;upah_bruto:number;upah_retensi:number;upah_netto:number};
const param=(p:Params,key:string)=>Array.isArray(p[key])?p[key]![0]??'':p[key]??'';
const money=(v:number)=>Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export default async function WageReport({params}:{params:Params}) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const from=param(params,'date_from')||today.slice(0,7)+'-01',to=param(params,'date_to')||today,spk=param(params,'spk'),mandor=param(params,'mandor');
 const supabase=await createClient();
 const [spks,mandors,company,banks]=await Promise.all([
  supabase.from('spk').select('id_spk,jenis_spk,id_kavling,nama_objek').eq('mode_progress','PERINCIAN').order('created_at',{ascending:false}),
  supabase.from('master_mandor').select('id_mandor,nama_mandor').order('nama_mandor'),
  supabase.from('company_settings').select('nama_perusahaan,logo_data_url').eq('id',true).maybeSingle(),
  supabase.from('master_bank').select('id_bank,nama_bank,status_aktif').order('nama_bank'),
 ]);
 let error=spks.error?.message??mandors.error?.message??company.error?.message??banks.error?.message??'';
 if(!validDate(from)||!validDate(to)||from>to)error='Periode awal harus valid dan tidak melewati periode akhir.';
 if(spk&&!(spks.data??[]).some(s=>s.id_spk===spk))error='SPK tidak tersedia untuk laporan perincian upah.';
 if(mandor&&!(mandors.data??[]).some(m=>m.id_mandor===mandor))error='Mandor tidak tersedia.';
 const result=error?{data:null,error:null}:await supabase.rpc('kavio_wage_report',{p_from:from,p_to:to,p_spk:spk||null,p_mandor:mandor||null});
 error=error||result.error?.message||'';
 const rows=(result.data?.rows??[]) as Row[],totals=result.data?.totals??{upah_bruto:0,upah_retensi:0,upah_netto:0};
 const groups=new Map<string,{name:string;bruto:number;retensi:number;netto:number;rows:Row[]}>();
 for(const row of rows){const g=groups.get(row.id_mandor)??{name:row.nama_mandor,bruto:0,retensi:0,netto:0,rows:[]};g.bruto+=Number(row.upah_bruto);g.retensi+=Number(row.upah_retensi);g.netto+=Number(row.upah_netto);g.rows.push(row);groups.set(row.id_mandor,g);}
 const reportMeta=`${formatKavioDate(from)} — ${formatKavioDate(to)} · ${spk?`${(spks.data??[]).find(s=>s.id_spk===spk)?.jenis_spk} · ${(spks.data??[]).find(s=>s.id_spk===spk)?.id_kavling??(spks.data??[]).find(s=>s.id_spk===spk)?.nama_objek}`:'Semua SPK'}`;
 return <section className="kavio-panel kavio-print-report"><div className="kavio-panel-head kavio-no-print"><div><h2 className="kavio-panel-title">LAPORAN UPAH BORONGAN</h2><p className="kavio-panel-note">Dasar tagihan dari progress perincian pada periode yang dipilih.</p></div><div className="kavio-actions"><KavioPrintButton label="CETAK UPAH BORONGAN" disabled={Boolean(error)||!rows.length}/><KavioReportActions print={false} title="Upah Borongan" disabled={Boolean(error)} headers={['MANDOR','SPK','OBJEK','KATEGORI','PEKERJAAN','VOLUME','SATUAN','PROGRESS PERIODE (%)','AKUMULASI (%)','BRUTO','RETENSI','NETTO']} rows={rows.map(r=>[r.nama_mandor,r.jenis_spk,r.id_kavling??r.nama_objek,r.nama_kategori,r.nama_pekerjaan,Number(r.volume),r.satuan,Number(r.progress_periode)*100,Number(r.progress_akumulasi)*100,Number(r.upah_bruto),Number(r.upah_retensi),Number(r.upah_netto)])} totals={[{label:'BRUTO',value:Number(totals.upah_bruto)},{label:'RETENSI',value:Number(totals.upah_retensi)},{label:'NETTO',value:Number(totals.upah_netto)}]}/></div></div>
 <form method="get" className="kavio-no-print"><KavioFilterBar><input type="hidden" name="jenis" value="upah"/><KavioFilterField label="DARI TANGGAL" kind="date"><input type="date" name="date_from" defaultValue={from} required/></KavioFilterField><KavioFilterField label="SAMPAI TANGGAL" kind="date"><input type="date" name="date_to" defaultValue={to} required/></KavioFilterField><KavioFilterField label="SPK / OBJEK" kind="select"><select name="spk" defaultValue={spk}><option value="">SEMUA SPK</option>{(spks.data??[]).map(s=><option key={s.id_spk} value={s.id_spk}>{s.jenis_spk} · {s.id_kavling??s.nama_objek} · {s.id_spk.slice(0,8)}</option>)}</select></KavioFilterField><KavioFilterField label="MANDOR" kind="select"><select name="mandor" defaultValue={mandor}><option value="">SEMUA MANDOR</option>{(mandors.data??[]).map(m=><option key={m.id_mandor} value={m.id_mandor}>{m.nama_mandor}</option>)}</select></KavioFilterField><KavioFilterActions><button className="kavio-button" type="submit">TAMPILKAN</button><Link href="/laporan?jenis=upah" className="kavio-button secondary">RESET</Link></KavioFilterActions></KavioFilterBar></form>
 {error&&<div className="kavio-alert error">{error}</div>}
 <KavioReportHeading company={company.data} title="UPAH BORONGAN · DASAR TAGIHAN" meta={reportMeta} className="kavio-no-print"/>
 {!rows.length&&<p className="kavio-empty">{error?'LAPORAN TIDAK DAPAT DIBACA.':'BELUM ADA TAGIHAN UPAH PADA PERIODE / FILTER INI.'}</p>}
 {Array.from(groups.entries()).map(([id,g])=><section className="kavio-report-group" key={id} aria-label={`Rincian upah ${g.name}`}>
  <KavioReportHeading company={company.data} title={`UPAH BORONGAN · ${g.name}`} meta={reportMeta} className="kavio-print-only"/>
  <h3 className="kavio-report-section-title kavio-no-print">MANDOR · {g.name}</h3>
  <div className="kavio-table-wrap"><table className="kavio-table kavio-wage-table"><thead><tr><th>SPK / OBJEK</th><th>PEKERJAAN</th><th>VOLUME</th><th>PROGRESS PERIODE</th><th>AKUMULASI S/D AKHIR PERIODE</th><th className="kavio-number">BRUTO</th><th className="kavio-number">RETENSI</th><th className="kavio-number">NETTO</th></tr></thead><tbody>{g.rows.map(r=><tr key={`${r.id_detail}:${r.id_mandor}`}><td>{r.jenis_spk} · {r.id_kavling??r.nama_objek}<small className="kavio-report-subtext">SPK {r.id_spk.slice(0,8)}</small></td><td>{r.nama_pekerjaan}<small className="kavio-report-subtext">{r.nama_kategori}</small></td><td>{Number(r.volume).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})} {r.satuan}</td><td>{(Number(r.progress_periode)*100).toFixed(2)}%</td><td>{(Number(r.progress_akumulasi)*100).toFixed(2)}%</td><td className="kavio-number">{money(r.upah_bruto)}</td><td className="kavio-number">{money(r.upah_retensi)}<small className="kavio-report-subtext">{Number(r.retensi)*100}%</small></td><td className="kavio-number">{money(r.upah_netto)}</td></tr>)}</tbody><tfoot><tr><td colSpan={5}>SUBTOTAL · {g.name}</td><td className="kavio-number">{money(g.bruto)}</td><td className="kavio-number">{money(g.retensi)}</td><td className="kavio-number">{money(g.netto)}</td></tr></tfoot></table></div>
 </section>)}
 {groups.size>0&&<section className="kavio-report-recap kavio-print-new-page" aria-label="Rekap upah seluruh mandor">
  <KavioReportHeading company={company.data} title="REKAP UPAH BORONGAN PER MANDOR" meta={reportMeta}/>
  <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>MANDOR</th><th className="kavio-number">BRUTO</th><th className="kavio-number">RETENSI</th><th className="kavio-number">NETTO</th></tr></thead><tbody>{Array.from(groups.entries()).map(([id,g])=><tr key={id}><td>{g.name}</td><td className="kavio-number">{money(g.bruto)}</td><td className="kavio-number">{money(g.retensi)}</td><td className="kavio-number">{money(g.netto)}</td></tr>)}</tbody><tfoot><tr><td>TOTAL DASAR TAGIHAN PERIODE</td><td className="kavio-number">{money(totals.upah_bruto)}</td><td className="kavio-number">{money(totals.upah_retensi)}</td><td className="kavio-number">{money(totals.upah_netto)}</td></tr></tfoot></table></div>
 </section>}
 <p className="kavio-report-note">Dasar tagihan sesuai progress tercatat; pembayaran dan retensi dicatat pada panel terpisah di bawah.</p>
 <WagePayments today={today} banks={banks.data??[]} mandors={mandors.data??[]}/>
 </section>;
}
