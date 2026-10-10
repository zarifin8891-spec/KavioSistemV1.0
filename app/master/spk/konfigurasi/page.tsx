import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/server';
import KavioWorkDetailEditor from '../../../components/KavioWorkDetailEditor';
import KavioActionGate from '../../../components/KavioActionGate';
import {WorkDetail,workMoney,workItemWage} from '../../../lib/work-detail';
import {saveSpkWorkConfig} from './actions';
export default async function SpkWorkConfigPage({searchParams}:{searchParams:Promise<{id?:string;edit?:string;error?:string;success?:string}>}) {
 const params=await searchParams;if(!params.id||!/^[0-9a-f-]{36}$/i.test(params.id))notFound();
 const supabase=await createClient();
 const [spkResult,parentResult,mandorResult]=await Promise.all([
  supabase.from('spk').select('id_spk,id_kavling,jenis_spk,nama_objek,id_tipe,id_mandor,status_spk,is_active,mode_progress,total_upah_borongan,configured_at').eq('id_spk',params.id).maybeSingle(),
  supabase.from('spk_work_item').select('id_item,nama_pekerjaan,bobot,id_kategori_legacy,urutan').eq('id_spk',params.id).order('urutan'),
  supabase.from('master_mandor').select('id_mandor,nama_mandor,status_aktif').order('nama_mandor'),
 ]);
 const spk=spkResult.data;
 if(!spk){if(spkResult.error)throw Error(spkResult.error.message);notFound();}
 const parents=parentResult.data??[];
 const [detailResult,masterResult,typeResult,progressResult]=await Promise.all([
  parents.length?supabase.from('spk_work_detail').select('id_item,urutan,nama_pekerjaan,volume,satuan,bobot,retensi,id_mandor').in('id_item',parents.map(w=>w.id_item)).order('urutan'):Promise.resolve({data:[],error:null}),
  spk.id_tipe?supabase.from('master_work_detail').select('id_kategori,urutan,nama_pekerjaan,volume,satuan,bobot,retensi').eq('id_tipe',spk.id_tipe).order('urutan'):Promise.resolve({data:[],error:null}),
  spk.id_tipe?supabase.from('master_tipe_rumah').select('perincian_siap').eq('id_tipe',spk.id_tipe).maybeSingle():Promise.resolve({data:null,error:null}),
  supabase.from('progress_update').select('id_progress',{head:true,count:'exact'}).eq('id_spk',spk.id_spk),
 ]);
 const groups=parents.map(w=>({id_kategori:w.id_item,nama_kategori:w.nama_pekerjaan,bobot:Number(w.bobot)}));
 const details:WorkDetail[]=(detailResult.data??[]).map(d=>({group_id:d.id_item,urutan:d.urutan,nama_pekerjaan:d.nama_pekerjaan,volume:Number(d.volume),satuan:d.satuan,bobot:Number(d.bobot),retensi:Number(d.retensi),id_mandor:d.id_mandor}));
 const reference:WorkDetail[]=(typeResult.data?.perincian_siap?masterResult.data??[]:[]).flatMap(d=>{const parent=parents.find(p=>p.id_kategori_legacy===d.id_kategori);return parent?[{group_id:parent.id_item,urutan:d.urutan,nama_pekerjaan:d.nama_pekerjaan,volume:Number(d.volume),satuan:d.satuan,bobot:Number(d.bobot),retensi:Number(d.retensi),id_mandor:spk.id_mandor}]:[];});
 const readError=[spkResult,parentResult,mandorResult,detailResult,masterResult,typeResult,progressResult].find(r=>r.error)?.error?.message;
 const locked=spk.status_spk!=='DRAFT'||spk.is_active||(progressResult.count??0)>0||Boolean(readError);
 const mandors=mandorResult.data??[];
 return <main className="master-simple-page">{(params.error||readError)&&<div className="kavio-alert error">{params.error||readError}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}
 <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">KONFIGURASI PEKERJAAN · {spk.jenis_spk==='FASUM'?spk.nama_objek:spk.id_kavling}</h2><p className="kavio-panel-note">{locked?'SPK berjalan atau berhistori: konfigurasi tersimpan terkunci.':'Atur cara input, bobot, total upah, retensi, dan satu mandor untuk setiap item sebelum aktivasi.'}</p></div><Link className="kavio-button secondary" href="/master/spk">DAFTAR SPK</Link></div>
 <div className="kavio-panel-body"><div className="work-detail-summary"><span className="kavio-badge">{spk.status_spk}</span><span>MODE: {spk.mode_progress}</span><span>TOTAL UPAH: <strong>{workMoney(Number(spk.total_upah_borongan))}</strong></span><span>{spk.configured_at?'KONFIGURASI TERSIMPAN':'BELUM DIKONFIGURASI'}</span></div>
 <KavioActionGate action="SPK_WRITE"><KavioWorkDetailEditor spk identifier={spk.id_spk} initial={{total_upah:Number(spk.total_upah_borongan),mode:spk.mode_progress,groups,details}} action={saveSpkWorkConfig} defaultMandor={spk.id_mandor} mandors={mandors.filter(m=>m.status_aktif||details.some(d=>d.id_mandor===m.id_mandor))} reference={reference} readOnly={locked} autoOpen={params.edit==='1'}/></KavioActionGate>
 {spk.mode_progress==='PERINCIAN'&&<p className="kavio-panel-note">Mode perincian disiapkan pada SPK draft. Input progress dan tagihan upah tersedia pada tahap berikutnya.</p>}
 {groups.map(g=><section className="work-detail-group" key={g.id_kategori}><div className="work-detail-group-head"><h3>{g.nama_kategori}</h3><span>BOBOT: {(g.bobot*100).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}%</span></div><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>PEKERJAAN</th><th>VOLUME</th><th>SATUAN</th><th>BOBOT (%)</th><th>MANDOR</th><th>RETENSI</th><th className="work-detail-money">TOTAL UPAH</th></tr></thead><tbody>{details.filter(d=>d.group_id===g.id_kategori).map(d=><tr key={d.urutan}><td>{d.nama_pekerjaan}</td><td>{d.volume.toLocaleString('id-ID')}</td><td>{d.satuan}</td><td>{(d.bobot*100).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{mandors.find(m=>m.id_mandor===d.id_mandor)?.nama_mandor??d.id_mandor}</td><td>{d.retensi===0?'Tanpa retensi':'5%'}</td><td className="work-detail-money">{workMoney(workItemWage(d.bobot,Number(spk.total_upah_borongan)))}</td></tr>)}{!details.some(d=>d.group_id===g.id_kategori)&&<tr><td className="kavio-empty" colSpan={7}>{spk.mode_progress==='KATEGORI'?'Input progress menggunakan kategori.':'Belum ada perincian tersimpan.'}</td></tr>}</tbody></table></div></section>)}
 </div></section></main>;
}
