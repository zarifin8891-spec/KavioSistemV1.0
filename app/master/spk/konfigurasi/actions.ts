'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '../../../../lib/supabase/server';
import {requireKavioAction} from '../../../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../../../lib/kavio-form-feedback';
import type {WorkEditorState} from '../../../lib/work-detail';
export async function saveSpkWorkConfig(form:FormData) {
 await requireKavioAction('SPK_WRITE');
 const id=String(form.get('id_spk')??'');
 const fail=(message:string):never=>redirectKavioFormError('/master/spk/konfigurasi',message,{params:{id,edit:1}});
 let state:WorkEditorState;
 try{state=JSON.parse(String(form.get('editor_state')));if(!Array.isArray(state.groups)||!Array.isArray(state.details)||state.details.length>1000)throw Error();}catch{fail('Konfigurasi tidak valid.');}
 const supabase=await createClient();
 const {error}=await supabase.rpc('configure_spk_work_atomic',{p_id_spk:id,p_mode:state!.mode,p_total_upah:state!.total_upah,p_parents:state!.groups.map(g=>({id_kategori:g.id_kategori,bobot:g.bobot})),p_details:state!.details.map((d,i)=>({...d,urutan:i+1}))});
 if(error)fail(error.message);
 revalidatePath('/master/spk');revalidatePath('/master/spk/konfigurasi');revalidatePath('/progress');
 redirect(`/master/spk/konfigurasi?id=${encodeURIComponent(id)}&success=Konfigurasi+SPK+berhasil+disimpan`);
}
