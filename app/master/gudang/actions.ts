'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

async function authorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MATERIAL_WAREHOUSE_WRITE', '/master/gudang?error=akses+ditolak');
  return supabase;
}

export async function saveWarehouse(form: FormData) {
  const supabase = await authorized();
  const id = value(form, 'id_lokasi');
  const fail = (message: string): never => redirectKavioFormError('/master/gudang', message, { form: id ? undefined : 'master-gudang-create', focus: 'nama_lokasi', params: id ? { edit: id } : undefined });
  const fields = {kode_lokasi:value(form,'kode_lokasi'),nama_lokasi:value(form,'nama_lokasi'),jenis_lokasi:'GUDANG'};
  if (!fields.kode_lokasi) fail('ID gudang wajib diisi.');
  if (!fields.nama_lokasi) fail('Nama gudang wajib diisi.');
  const result = id
    ? await supabase.from('material_location').update(fields).eq('id_lokasi', id).eq('jenis_lokasi','GUDANG').select('id_lokasi').single()
    : await supabase.from('material_location').insert(fields).select('id_lokasi').single();
  if (result.error) fail(result.error.code === '23505' ? 'ID gudang sudah terdaftar.' : result.error.message);
  revalidatePath('/master/gudang'); revalidatePath('/material');
  redirect('/master/gudang?success=Gudang+berhasil+disimpan');
}

export async function toggleWarehouse(form: FormData) {
  const supabase = await authorized();
  const id = value(form, 'id_lokasi');
  if (!id) redirectKavioFormError('/master/gudang', 'Gudang tidak valid.');
  const { error } = await supabase.from('material_location').update({ status_aktif: value(form, 'status_aktif') !== 'true' }).eq('id_lokasi', id).eq('jenis_lokasi','GUDANG').select('id_lokasi').single();
  if (error) redirectKavioFormError('/master/gudang', error.message);
  revalidatePath('/master/gudang'); revalidatePath('/material');
  redirect('/master/gudang?success=Status+gudang+diperbarui');
}

export async function deleteWarehouse(form:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login');
 await requireKavioAction('MATERIAL_WAREHOUSE_WRITE','/master/gudang?error=akses+ditolak');
 const id=String(form.get('id_lokasi')??'');
 const {error}=await supabase.from('material_location').delete().eq('id_lokasi',id).eq('jenis_lokasi','GUDANG').select('id_lokasi').single();
 if(error)redirectKavioFormError('/master/gudang',error.code==='23503'?'Data sudah digunakan dan tidak dapat dihapus. Gunakan Nonaktifkan.':error.message);
 revalidatePath('/master/gudang'); revalidatePath('/material'); redirect('/master/gudang?success=Data+dihapus');
}
