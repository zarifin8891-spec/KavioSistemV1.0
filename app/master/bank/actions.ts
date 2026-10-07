"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }

function createFail(message: string, focus = 'id_bank'): never {
  redirectKavioFormError('/master/bank', message, { form: 'master-bank-create', focus });
}

function editFail(idBank: string, message: string, focus = 'nama_bank'): never {
  redirectKavioFormError('/master/bank', message, { focus, params: { edit: idBank } });
}

export async function createBank(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/bank?error=');

  const idBank = text(formData.get('id_bank'));
  const namaBank = text(formData.get('nama_bank'));
  const keterangan = text(formData.get('keterangan')) || null;

  if (!idBank) createFail('ID bank wajib diisi', 'id_bank');
  if (!namaBank) createFail('Nama bank wajib diisi', 'nama_bank');

  const { error } = await supabase.from('master_bank').insert({ id_bank: idBank, nama_bank: namaBank, keterangan });
  if (error) createFail(error.message, error.message.toLowerCase().includes('id') ? 'id_bank' : 'nama_bank');

  revalidatePath('/master/bank');
  revalidatePath('/master/sales');
  redirect('/master/bank?success=Bank%20berhasil%20ditambahkan');
}

export async function updateBank(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/bank?error=');

  const idBank = text(formData.get('id_bank'));
  const namaBank = text(formData.get('nama_bank'));
  const keterangan = text(formData.get('keterangan')) || null;

  if (!idBank) redirectKavioFormError('/master/bank', 'ID bank tidak valid');
  if (!namaBank) editFail(idBank, 'Nama bank wajib diisi', 'nama_bank');

  const { error } = await supabase.from('master_bank').update({ nama_bank: namaBank, keterangan }).eq('id_bank', idBank);
  if (error) editFail(idBank, error.message);

  revalidatePath('/master/bank');
  revalidatePath('/master/sales');
  redirect('/master/bank?success=Bank%20berhasil%20diperbarui');
}

export async function toggleBank(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/bank?error=');

  const idBank = text(formData.get('id_bank'));
  const status = text(formData.get('status_aktif')) === 'true';
  if (!idBank) redirectKavioFormError('/master/bank', 'ID bank tidak valid');

  const { error } = await supabase.from('master_bank').update({ status_aktif: !status }).eq('id_bank', idBank);
  if (error) redirectKavioFormError('/master/bank', error.message);

  revalidatePath('/master/bank');
  revalidatePath('/master/sales');
  redirect('/master/bank?success=Status%20bank%20diperbarui');
}
