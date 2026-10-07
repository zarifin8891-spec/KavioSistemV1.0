"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }

function createFail(message: string, focus = 'id_notaris'): never {
  redirectKavioFormError('/master/notaris', message, { form: 'master-notaris-create', focus });
}

function editFail(idNotaris: string, message: string, focus = 'nama_notaris'): never {
  redirectKavioFormError('/master/notaris', message, { focus, params: { edit: idNotaris } });
}

export async function createNotaris(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/notaris?error=');

  const idNotaris = text(formData.get('id_notaris'));
  const namaNotaris = text(formData.get('nama_notaris'));
  const noIzin = text(formData.get('no_izin')) || null;
  const noHp = text(formData.get('no_hp')) || null;
  const alamat = text(formData.get('alamat')) || null;

  if (!idNotaris) createFail('ID notaris wajib diisi', 'id_notaris');
  if (!namaNotaris) createFail('Nama notaris wajib diisi', 'nama_notaris');

  const { error } = await supabase.from('master_notaris').insert({
    id_notaris: idNotaris,
    nama_notaris: namaNotaris,
    no_izin: noIzin,
    no_hp: noHp,
    alamat,
  });
  if (error) createFail(error.message, error.message.toLowerCase().includes('id') ? 'id_notaris' : 'nama_notaris');

  revalidatePath('/master/notaris');
  revalidatePath('/master/sales');
  redirect('/master/notaris?success=Notaris%20berhasil%20ditambahkan');
}

export async function updateNotaris(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/notaris?error=');

  const idNotaris = text(formData.get('id_notaris'));
  const namaNotaris = text(formData.get('nama_notaris'));
  const noIzin = text(formData.get('no_izin')) || null;
  const noHp = text(formData.get('no_hp')) || null;
  const alamat = text(formData.get('alamat')) || null;

  if (!idNotaris) redirectKavioFormError('/master/notaris', 'ID notaris tidak valid');
  if (!namaNotaris) editFail(idNotaris, 'Nama notaris wajib diisi', 'nama_notaris');

  const { error } = await supabase.from('master_notaris').update({
    nama_notaris: namaNotaris,
    no_izin: noIzin,
    no_hp: noHp,
    alamat,
  }).eq('id_notaris', idNotaris);
  if (error) editFail(idNotaris, error.message);

  revalidatePath('/master/notaris');
  revalidatePath('/master/sales');
  redirect('/master/notaris?success=Notaris%20berhasil%20diperbarui');
}

export async function toggleNotaris(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/notaris?error=');

  const idNotaris = text(formData.get('id_notaris'));
  const status = text(formData.get('status_aktif')) === 'true';
  if (!idNotaris) redirectKavioFormError('/master/notaris', 'ID notaris tidak valid');

  const { error } = await supabase.from('master_notaris').update({ status_aktif: !status }).eq('id_notaris', idNotaris);
  if (error) redirectKavioFormError('/master/notaris', error.message);

  revalidatePath('/master/notaris');
  revalidatePath('/master/sales');
  redirect('/master/notaris?success=Status%20notaris%20diperbarui');
}
