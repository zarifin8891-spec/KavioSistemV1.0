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
  await requireKavioAction('MATERIAL_WAREHOUSE_WRITE', '/master/pemasok?error=akses+ditolak');
  return supabase;
}

export async function saveSupplier(form: FormData) {
  const supabase = await authorized();
  const id = value(form, 'id_pemasok');
  const fail = (message: string): never => redirectKavioFormError('/master/pemasok', message, { form: id ? undefined : 'master-pemasok-create', focus: 'nama_pemasok', params: id ? { edit: id } : undefined });
  const fields = { nama_pemasok: value(form, 'nama_pemasok'), kontak: value(form, 'kontak') || null, telepon: value(form, 'telepon') || null, alamat: value(form, 'alamat') || null, keterangan: value(form, 'keterangan') || null };
  if (!fields.nama_pemasok) fail('Nama pemasok wajib diisi.');
  const result = id
    ? await supabase.from('master_pemasok').update(fields).eq('id_pemasok', id).select('id_pemasok').single()
    : await supabase.from('master_pemasok').insert(fields).select('id_pemasok').single();
  if (result.error) fail(result.error.code === '23505' ? 'Nama pemasok sudah terdaftar.' : result.error.message);
  revalidatePath('/master/pemasok'); revalidatePath('/material');
  redirect('/master/pemasok?success=Pemasok+berhasil+disimpan');
}

export async function toggleSupplier(form: FormData) {
  const supabase = await authorized();
  const id = value(form, 'id_pemasok');
  if (!id) redirectKavioFormError('/master/pemasok', 'Pemasok tidak valid.');
  const { error } = await supabase.from('master_pemasok').update({ status_aktif: value(form, 'status_aktif') !== 'true' }).eq('id_pemasok', id).select('id_pemasok').single();
  if (error) redirectKavioFormError('/master/pemasok', error.message);
  revalidatePath('/master/pemasok'); revalidatePath('/material');
  redirect('/master/pemasok?success=Status+pemasok+diperbarui');
}

export async function deleteSupplier(form:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)redirect('/login');
 await requireKavioAction('MATERIAL_WAREHOUSE_WRITE','/master/pemasok?error=akses+ditolak');
 const id=String(form.get('id_pemasok')??'');
 const {error}=await supabase.from('master_pemasok').delete().eq('id_pemasok',id).select('id_pemasok').single();
 if(error)redirectKavioFormError('/master/pemasok',error.code==='23503'?'Data sudah digunakan dan tidak dapat dihapus. Gunakan Nonaktifkan.':error.message);
 revalidatePath('/master/pemasok'); revalidatePath('/penerimaan'); redirect('/master/pemasok?success=Data+dihapus');
}
