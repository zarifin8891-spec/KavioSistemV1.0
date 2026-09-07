"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function number(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function createTipeRumah(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idTipe = text(formData.get('id_tipe'));
  const namaTipe = text(formData.get('nama_tipe'));
  const luasTanah = number(formData.get('luas_tanah'));
  const luasBangunan = number(formData.get('luas_bangunan'));

  if (!idTipe || !namaTipe) {
    redirect('/master/tipe-rumah?error=ID%20dan%20nama%20tipe%20wajib%20diisi');
  }

  if (!Number.isFinite(luasTanah) || luasTanah <= 0 || !Number.isFinite(luasBangunan) || luasBangunan <= 0) {
    redirect('/master/tipe-rumah?error=Luas%20tanah%20dan%20luas%20bangunan%20harus%20bernilai%20positif');
  }

  const { error } = await supabase.from('master_tipe_rumah').insert({
    id_tipe: idTipe,
    nama_tipe: namaTipe,
    luas_tanah: luasTanah,
    luas_bangunan: luasBangunan,
    status_aktif: true,
  });

  if (error) {
    redirect(`/master/tipe-rumah?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/tipe-rumah');
  revalidatePath('/master/kavling');
  revalidatePath('/dashboard');
  redirect('/master/tipe-rumah?success=Tipe%20rumah%20berhasil%20ditambahkan');
}

export async function toggleTipeRumah(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idTipe = text(formData.get('id_tipe'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idTipe) redirect('/master/tipe-rumah?error=ID%20tipe%20tidak%20valid');

  const { error } = await supabase
    .from('master_tipe_rumah')
    .update({ status_aktif: !statusAktif })
    .eq('id_tipe', idTipe);

  if (error) {
    redirect(`/master/tipe-rumah?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/tipe-rumah');
  revalidatePath('/master/kavling');
  redirect('/master/tipe-rumah');
}
