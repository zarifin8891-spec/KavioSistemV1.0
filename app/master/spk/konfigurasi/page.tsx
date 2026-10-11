import {notFound} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/server';
import KavioWorkDetailEditor from '../../../components/KavioWorkDetailEditor';
import KavioActionGate from '../../../components/KavioActionGate';
import {WorkDetail} from '../../../lib/work-detail';
import {saveSpkWorkConfig} from './actions';
export default async function SpkWorkConfigPage({searchParams}:{searchParams:Promise<{id?:string;edit?:string;error?:string;success?:string}>}) {
 const params=await searchParams;if(!params.id||!/^[0-9a-f-]{36}$/i.test(params.id))notFound();
 const supabase=await createClient();
 const [spkResult,parentResult,mandorResult]=await Promise.all([
  supabase.from('spk').select('id_spk,id_kavling,jenis_spk,nama_objek,id_tipe,id_mandor,status_spk,is_active,mode_progress,total_upah_borongan,configured_at').eq('id_spk',params.id).maybeSingle(),
  supabase.from('spk_work_item').select('id_item,nama_pekerjaan,bobot,id_kategori_legacy,urutan,volume,satuan,harga_satuan_upah,keterangan').eq('id_spk',params.id).order('urutan'),
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
 if(spk.jenis_spk==='FASUM'&&!spk.configured_at&&!details.length)for(const p of parents)if(Number(p.volume)>0&&p.satuan)details.push({group_id:p.id_item,urutan:p.urutan,nama_pekerjaan:p.nama_pekerjaan,volume:Number(p.volume),satuan:p.satuan,bobot:Number(p.bobot),retensi:.05,id_mandor:spk.id_mandor});
 const reference:WorkDetail[]=(typeResult.data?.perincian_siap?masterResult.data??[]:[]).flatMap(d=>{const parent=parents.find(p=>p.id_kategori_legacy===d.id_kategori);return parent?[{group_id:parent.id_item,urutan:d.urutan,nama_pekerjaan:d.nama_pekerjaan,volume:Number(d.volume),satuan:d.satuan,bobot:Number(d.bobot),retensi:Number(d.retensi),id_mandor:spk.id_mandor}]:[];});
 const readError=[spkResult,parentResult,mandorResult,detailResult,masterResult,typeResult,progressResult].find(r=>r.error)?.error?.message;
 const locked=spk.status_spk!=='DRAFT'||spk.is_active||(progressResult.count??0)>0||Boolean(readError);
 const mandors=mandorResult.data??[];
 return <main className="master-simple-page"><KavioActionGate action="SPK_WRITE"><KavioWorkDetailEditor spk identifier={spk.id_spk} initial={{total_upah:Number(spk.total_upah_borongan),mode:spk.mode_progress,groups,details}} action={saveSpkWorkConfig} defaultMandor={spk.id_mandor} mandors={mandors.filter(m=>m.status_aktif||details.some(d=>d.id_mandor===m.id_mandor))} reference={reference} wageBasis={spk.jenis_spk==='FASUM'&&parents.some(p=>p.harga_satuan_upah!==null)?parents.map(p=>({group_id:p.id_item,nama:p.nama_pekerjaan,volume:Number(p.volume),satuan:p.satuan??'',rate:Number(p.harga_satuan_upah),keterangan:p.keterangan??''})):undefined} readOnly={locked} autoOpen closeHref="/master/spk"/></KavioActionGate>{readError&&<div className="kavio-alert error">{readError}</div>}</main>;
}
