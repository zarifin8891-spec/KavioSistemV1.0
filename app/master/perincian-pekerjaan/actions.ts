'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '../../../lib/supabase/server';
import {requireKavioAction} from '../../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../../lib/kavio-form-feedback';
import type {WorkEditorState} from '../../lib/work-detail';
export async function saveWorkMaster(form:FormData) {
 await requireKavioAction('MASTER_WRITE');
 const type=String(form.get('id_tipe')??'');
 const fail=(message:string):never=>redirectKavioFormError('/master/perincian-pekerjaan',message,{params:{tipe:type,edit:1}});
 let state:WorkEditorState;
 try {state=JSON.parse(String(form.get('editor_state')));if(!Array.isArray(state.groups)||!Array.isArray(state.details)||state.details.length>1000)throw Error();}catch{fail('Data perincian tidak valid.');}
 const supabase=await createClient();
 const {error}=await supabase.rpc('save_work_master_atomic',{p_id_tipe:type,p_total_upah:state!.total_upah,p_categories:state!.groups.map(g=>({id_kategori:g.id_kategori,bobot:g.bobot})),p_details:state!.details.map((d,i)=>({...d,urutan:i+1})),p_publish:form.get('publish')==='true'});
 if(error)fail(error.message);
 for(const path of ['/master/perincian-pekerjaan','/master/kategori-pekerjaan','/master/template-progress','/master/tipe-rumah','/master/spk'])revalidatePath(path);
 redirect(`/master/perincian-pekerjaan?tipe=${encodeURIComponent(type)}&success=${encodeURIComponent(form.get('publish')==='true'?'Perincian tervalidasi dan siap digunakan untuk SPK baru.':'Draft perincian disimpan; belum siap digunakan.')}`);
}
