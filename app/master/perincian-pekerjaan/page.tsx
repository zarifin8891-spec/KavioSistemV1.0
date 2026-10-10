import {createClient} from '../../../lib/supabase/server';
import {requireKavioAction} from '../../../lib/kavio-permissions-server';
import WorkMasterCatalog from './WorkMasterCatalog';
export default async function WorkMasterPage({searchParams}:{searchParams:Promise<{tipe?:string;edit?:string;error?:string;success?:string}>}) {
 await requireKavioAction('MASTER_WRITE');
 const params=await searchParams,supabase=await createClient();
 const results=await Promise.all([
  supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe,total_upah_borongan,perincian_siap').eq('status_aktif',true).order('nama_tipe'),
  supabase.from('master_kategori_pekerjaan').select('id_kategori,nama_kategori,urutan').eq('status_aktif',true).order('urutan'),
 ]);
 const types=results[0].data??[],categories=results[1].data??[];
 const selected=types.find(t=>t.id_tipe===params.tipe)??types[0];
 const [templates,detailResult]=selected?await Promise.all([
  supabase.from('template_progress_tipe').select('id_kategori,bobot_standar').eq('id_tipe',selected.id_tipe),
  supabase.from('master_work_detail').select('id_kategori,urutan,nama_pekerjaan,volume,satuan,bobot,retensi').eq('id_tipe',selected.id_tipe).order('urutan'),
 ]):[{data:[],error:null},{data:[],error:null}];
 const groups=categories.map(c=>({id_kategori:c.id_kategori,nama_kategori:c.nama_kategori,bobot:Number(templates.data?.find(t=>t.id_kategori===c.id_kategori)?.bobot_standar??0)}));
 const details=(detailResult.data??[]).map(d=>({group_id:d.id_kategori,urutan:d.urutan,nama_pekerjaan:d.nama_pekerjaan,volume:Number(d.volume),satuan:d.satuan,bobot:Number(d.bobot),retensi:Number(d.retensi)}));
 const error=params.error??results.find(r=>r.error)?.error?.message??templates.error?.message??detailResult.error?.message;
 return <main className="master-simple-page">{error&&<div className="kavio-alert error">{error}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}
 <WorkMasterCatalog key={selected?.id_tipe??'empty'} types={types} selected={selected} initial={{total_upah:Number(selected?.total_upah_borongan??0),mode:'PERINCIAN',groups,details}} autoOpen={params.edit==='1'}/>
 </main>;
}
