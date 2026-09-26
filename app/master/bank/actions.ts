"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }
function fail(message: string) { redirect(`/master/bank?error=${encodeURIComponent(message)}`); }

export async function createBank(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/bank?error=');
  const idBank = text(formData.get('id_bank'));
  const namaBank = text(formData.get('nama_bank'));
  const keterangan = text(formData.get('keterangan')) || null;
  if (!idBank || !namaBank) { fail('ID bank dan nama bank wajib diisi'); return; }
  const { error } = await supabase.from('master_bank').insert({ id_bank: idBank, nama_bank: namaBank, keterangan });
  if (error) { fail(error.message); return; }
  revalidatePath('/master/bank'); revalidatePath('/master/sales'); redirect('/master/bank?success=Bank%20berhasil%20ditambahkan');
}

export async function toggleBank(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/bank?error=');
  const idBank = text(formData.get('id_bank'));
  const status = text(formData.get('status_aktif')) === 'true';
  if (!idBank) { fail('ID bank tidak valid'); return; }
  const { error } = await supabase.from('master_bank').update({ status_aktif: !status }).eq('id_bank', idBank);
  if (error) { fail(error.message); return; }
  revalidatePath('/master/bank'); revalidatePath('/master/sales'); redirect('/master/bank?success=Status%20bank%20diperbarui');
}
