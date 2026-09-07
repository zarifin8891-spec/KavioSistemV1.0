"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function integer(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) ? parsed : NaN;
}

export async function createKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKategori = text(formData.get('id_kategori'));
  const namaKategori = text(formData.get('nama_kategori'));
  const urutan = integer(formData.get('urutan'));

  if (!idKategori || !namaKategori) {
    redirect('/master/kategori-pekerjaan?error=ID%20dan%20nama%20kategori%20wajib%20diisi');
  }

  if (!Number.isInteger(urutan) || urutan < 1) {
    redirect('/master/kategori-pekerjaan?error=Urutan%20harus%20berupa%20bilangan%20bulat%20positif');
  }

  const { error } = await supabase.from('master_kategori_pekerjaan').insert({
    id_kategori: idKategori,
    nama_kategori: namaKategori,
    urutan,
    status_aktif: true,
  });

  if (error) {
    redirect(`/master/kategori-pekerjaan?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/kategori-pekerjaan');
  redirect('/master/kategori-pekerjaan?success=Kategori%20pekerjaan%20berhasil%20ditambahkan');
}

export async function toggleKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKategori = text(formData.get('id_kategori'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKategori) redirect('/master/kategori-pekerjaan?error=ID%20kategori%20tidak%20valid');

  const { error } = await supabase
    .from('master_kategori_pekerjaan')
    .update({ status_aktif: !statusAktif })
    .eq('id_kategori', idKategori);

  if (error) {
    redirect(`/master/kategori-pekerjaan?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/kategori-pekerjaan');
  redirect('/master/kategori-pekerjaan');
}
