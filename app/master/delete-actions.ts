'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '../../lib/supabase/server';
import {requireKavioAction} from '../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../lib/kavio-form-feedback';
const MASTERS:Record<string,{table:string;keys:string[]}>= {
 'tipe-rumah':{table:'master_tipe_rumah',keys:['id_tipe']},'kategori-pekerjaan':{table:'master_kategori_pekerjaan',keys:['id_kategori']},
 'kantor-pelaksana':{table:'master_kantor_pelaksana',keys:['id_kantor']},'mandor':{table:'master_mandor',keys:['id_mandor']},'notaris':{table:'master_notaris',keys:['id_notaris']},
 'template-progress':{table:'template_progress_tipe',keys:['id_tipe','id_kategori']}
};
export async function deleteMaster(form:FormData){
 const kind=String(form.get('master')??'');const cfg=MASTERS[kind];if(!cfg)redirect('/master?error=master+tidak+valid');
 const path='/master/'+kind;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');await requireKavioAction('MASTER_WRITE',path+'?error=akses+ditolak');
 let q=supabase.from(cfg.table).delete();for(const key of cfg.keys){const val=String(form.get(key)??'');if(!val)redirectKavioFormError(path,'ID tidak valid');q=q.eq(key,val);}
 const {error}=await q.select(cfg.keys.join(',')).single();if(error)redirectKavioFormError(path,error.code==='23503'?'Data sudah digunakan dan tidak dapat dihapus.':error.message);
 revalidatePath(path);revalidatePath('/master');redirect(path+'?success=Data+dihapus');
}
