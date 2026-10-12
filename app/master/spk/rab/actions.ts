'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/server';
import {requireKavioAction} from '../../../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../../../lib/kavio-form-feedback';
export async function saveSpkMaterialPlan(form:FormData) {
 await requireKavioAction('SPK_WRITE');
 const id=String(form.get('id_spk')??''),reason=String(form.get('alasan')??'').trim(),source=String(form.get('id_rab')??'');
 let items:unknown=null;try{items=JSON.parse(String(form.get('items')??''));}catch{/* RPC rejects invalid rows. */}
 const revision=Number(form.get('revisi'));
 if(!/^[\da-f-]{36}$/i.test(id)||!Number.isInteger(revision)||revision<0||!Array.isArray(items)||!items.length||!reason)
  redirectKavioFormError('/master/spk/rab','Pilih material dan isi alasan penetapan / revisi RAB.',{focus:'rab_plan',params:{id}});
 const db=await createClient();
 const {error}=await db.rpc('save_spk_material_plan_atomic',{p_id_spk:id,p_items:items,p_id_rab:source||null,p_alasan:reason,p_expected_revision:revision});
 if(error)redirectKavioFormError('/master/spk/rab',error.message,{focus:'rab_plan',params:{id}});
 revalidatePath('/master/spk/rab');revalidatePath('/material');revalidatePath('/laporan');revalidatePath('/master/spk');
 redirect('/master/spk/rab?id='+encodeURIComponent(id)+'&success='+encodeURIComponent('RAB SPK berhasil disimpan sebagai revisi baru.'));
}

