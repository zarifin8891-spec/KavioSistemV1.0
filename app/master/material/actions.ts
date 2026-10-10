'use server';
import {MATERIAL_CATEGORIES} from '../../lib/material-categories';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '../../../lib/supabase/server';
import {requireKavioAction} from '../../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../../lib/kavio-form-feedback';
async function client(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');await requireKavioAction('MATERIAL_CATALOG_WRITE','/master/material?error=akses+ditolak');return s;}
export async function saveMaterial(form:FormData){
 const s=await client();const val=(k:string)=>String(form.get(k)??'').trim();const id=val('id_material');
 const fields={kode_referensi:val('kode_referensi')||null,nama_material:val('nama_material'),kategori:val('kategori'),satuan:val('satuan'),jenis_item:val('jenis_item')};
 const fail=(m:string):never=>redirectKavioFormError('/master/material',m,{form:id?undefined:'master-material-create',focus:'nama_material',params:id?{edit:id}:undefined});
 if(!fields.nama_material||!fields.kategori||!fields.satuan||!['BAHAN','ALAT_PAKAI_ULANG'].includes(fields.jenis_item)||fields.kategori.toUpperCase()==='UPAH')fail('Nama, kategori, satuan, dan jenis material wajib valid. Upah dikelola terpisah.');
 const {data:existingCategory,error:categoryError}=await s.from('master_material').select('id_material').eq('kategori',fields.kategori).neq('jenis_item','UPAH').limit(1);
 if(categoryError)fail(categoryError.message);
 if(!(MATERIAL_CATEGORIES as readonly string[]).includes(fields.kategori)&&!existingCategory?.length)fail('Pilih kategori material dari daftar yang tersedia.');
 const result=id?await s.from('master_material').update(fields).eq('id_material',id).neq('jenis_item','UPAH').select('id_material').single():await s.from('master_material').insert(fields).select('id_material').single();
 if(result.error)fail(result.error.message);revalidatePath('/master/material');revalidatePath('/material');redirect('/master/material?success=Material+disimpan');
}
export async function deleteMaterial(form:FormData){const s=await client();const {error}=await s.from('master_material').delete().eq('id_material',String(form.get('id_material')??'')).neq('jenis_item','UPAH').select('id_material').single();if(error)redirectKavioFormError('/master/material',error.code==='23503'?'Material sudah digunakan pada RAB/transaksi dan tidak dapat dihapus.':error.message);revalidatePath('/master/material');revalidatePath('/material');redirect('/master/material?success=Material+dihapus');}
