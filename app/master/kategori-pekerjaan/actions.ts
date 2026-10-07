"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function integer(value: FormDataEntryValue | null) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) ? parsed : NaN;
}

function createFail(message: string, focus = 'id_kategori'): never {
  redirectKavioFormError('/master/kategori-pekerjaan', message, { form: 'master-kategori-create', focus });
}

function editFail(idKategori: string, message: string, focus = 'nama_kategori'): never {
  redirectKavioFormError('/master/kategori-pekerjaan', message, { focus, params: { edit: idKategori } });
}

export async function createKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kategori-pekerjaan?error=');

  const idKategori = text(formData.get('id_kategori'));
  const namaKategori = text(formData.get('nama_kategori'));
  const urutan = integer(formData.get('urutan'));

  if (!idKategori || !namaKategori) {
    createFail('ID dan nama kategori wajib diisi', !idKategori ? 'id_kategori' : 'nama_kategori');
  }

  if (!Number.isInteger(urutan) || urutan < 1) {
    createFail('Urutan harus berupa bilangan bulat positif', 'urutan');
  }

  const { error } = await supabase.from('master_kategori_pekerjaan').insert({
    id_kategori: idKategori,
    nama_kategori: namaKategori,
    urutan,
    status_aktif: true,
  });

  if (error) {
    createFail(error.message);
  }

  revalidatePath('/master/kategori-pekerjaan');
  redirect('/master/kategori-pekerjaan?success=Kategori%20pekerjaan%20berhasil%20ditambahkan');
}


export async function updateKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kategori-pekerjaan?error=');

  const idKategori = text(formData.get('id_kategori'));
  const namaKategori = text(formData.get('nama_kategori'));
  const urutan = integer(formData.get('urutan'));
  if (!idKategori) redirectKavioFormError('/master/kategori-pekerjaan', 'ID kategori tidak valid');
  if (!namaKategori) editFail(idKategori, 'Nama kategori wajib diisi', 'nama_kategori');
  if (!Number.isInteger(urutan) || urutan < 1) editFail(idKategori, 'Urutan harus berupa bilangan bulat positif', 'urutan');

  const { error } = await supabase.from('master_kategori_pekerjaan').update({ nama_kategori: namaKategori, urutan }).eq('id_kategori', idKategori);
  if (error) editFail(idKategori, error.message);
  revalidatePath('/master/kategori-pekerjaan');
  revalidatePath('/master/template-progress');
  revalidatePath('/master/spk');
  redirect('/master/kategori-pekerjaan?success=Kategori%20pekerjaan%20berhasil%20diperbarui');
}

export async function toggleKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kategori-pekerjaan?error=');

  const idKategori = text(formData.get('id_kategori'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKategori) redirectKavioFormError('/master/kategori-pekerjaan', 'ID kategori tidak valid');

  const { error } = await supabase
    .from('master_kategori_pekerjaan')
    .update({ status_aktif: !statusAktif })
    .eq('id_kategori', idKategori);

  if (error) {
    redirectKavioFormError('/master/kategori-pekerjaan', error.message);
  }

  revalidatePath('/master/kategori-pekerjaan');
  redirect('/master/kategori-pekerjaan');
}
