"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function number(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function createFail(message: string, focus = 'id_tipe'): never {
  redirectKavioFormError('/master/tipe-rumah', message, { form: 'master-tipe-create', focus });
}

function editFail(idTipe: string, message: string, focus = 'nama_tipe'): never {
  redirectKavioFormError('/master/tipe-rumah', message, { focus, params: { edit: idTipe } });
}

export async function createTipeRumah(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/tipe-rumah?error=');

  const idTipe = text(formData.get('id_tipe'));
  const namaTipe = text(formData.get('nama_tipe'));
  const luasTanah = number(formData.get('luas_tanah'));
  const luasBangunan = number(formData.get('luas_bangunan'));

  if (!idTipe || !namaTipe) {
    createFail('ID dan nama tipe wajib diisi', !idTipe ? 'id_tipe' : 'nama_tipe');
  }

  if (!Number.isFinite(luasTanah) || luasTanah <= 0 || !Number.isFinite(luasBangunan) || luasBangunan <= 0) {
    createFail('Luas tanah dan luas bangunan harus bernilai positif', !Number.isFinite(luasTanah) || luasTanah <= 0 ? 'luas_tanah' : 'luas_bangunan');
  }

  const { error } = await supabase.from('master_tipe_rumah').insert({
    id_tipe: idTipe,
    nama_tipe: namaTipe,
    luas_tanah_m2: luasTanah,
    luas_bangunan_m2: luasBangunan,
    status_aktif: true,
  });

  if (error) {
    redirectKavioFormError('/master/tipe-rumah', error.message);
  }

  revalidatePath('/master/tipe-rumah');
  revalidatePath('/master/kavling');
  revalidatePath('/dashboard');
  redirect('/master/tipe-rumah?success=Tipe%20rumah%20berhasil%20ditambahkan');
}


export async function updateTipeRumah(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/tipe-rumah?error=');

  const idTipe = text(formData.get('id_tipe'));
  const namaTipe = text(formData.get('nama_tipe'));
  const luasTanah = number(formData.get('luas_tanah'));
  const luasBangunan = number(formData.get('luas_bangunan'));
  if (!idTipe) redirectKavioFormError('/master/tipe-rumah', 'ID tipe tidak valid');
  if (!namaTipe) editFail(idTipe, 'Nama tipe wajib diisi', 'nama_tipe');
  if (!Number.isFinite(luasTanah) || luasTanah <= 0 || !Number.isFinite(luasBangunan) || luasBangunan <= 0) {
    editFail(idTipe, 'Luas tanah dan luas bangunan harus bernilai positif', !Number.isFinite(luasTanah) || luasTanah <= 0 ? 'luas_tanah' : 'luas_bangunan');
  }

  const { error } = await supabase.from('master_tipe_rumah').update({
    nama_tipe: namaTipe,
    luas_tanah_m2: luasTanah,
    luas_bangunan_m2: luasBangunan,
  }).eq('id_tipe', idTipe);
  if (error) editFail(idTipe, error.message);

  revalidatePath('/master/tipe-rumah');
  revalidatePath('/master/kavling');
  revalidatePath('/master/template-progress');
  revalidatePath('/dashboard');
  redirect('/master/tipe-rumah?success=Tipe%20rumah%20berhasil%20diperbarui');
}

export async function toggleTipeRumah(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/tipe-rumah?error=');

  const idTipe = text(formData.get('id_tipe'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idTipe) redirectKavioFormError('/master/tipe-rumah', 'ID tipe tidak valid');

  const { error } = await supabase
    .from('master_tipe_rumah')
    .update({ status_aktif: !statusAktif })
    .eq('id_tipe', idTipe);

  if (error) {
    createFail(error.message);
  }

  revalidatePath('/master/tipe-rumah');
  revalidatePath('/master/kavling');
  redirect('/master/tipe-rumah');
}
