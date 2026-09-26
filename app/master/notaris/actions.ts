"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }
function fail(message: string) { redirect(`/master/notaris?error=${encodeURIComponent(message)}`); }

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
  if (!idNotaris || !namaNotaris) { fail('ID notaris dan nama notaris wajib diisi'); return; }
  const { error } = await supabase.from('master_notaris').insert({ id_notaris: idNotaris, nama_notaris: namaNotaris, no_izin: noIzin, no_hp: noHp, alamat });
  if (error) { fail(error.message); return; }
  revalidatePath('/master/notaris'); revalidatePath('/master/sales'); redirect('/master/notaris?success=Notaris%20berhasil%20ditambahkan');
}

export async function toggleNotaris(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/notaris?error=');
  const idNotaris = text(formData.get('id_notaris'));
  const status = text(formData.get('status_aktif')) === 'true';
  if (!idNotaris) { fail('ID notaris tidak valid'); return; }
  const { error } = await supabase.from('master_notaris').update({ status_aktif: !status }).eq('id_notaris', idNotaris);
  if (error) { fail(error.message); return; }
  revalidatePath('/master/notaris'); revalidatePath('/master/sales'); redirect('/master/notaris?success=Status%20notaris%20diperbarui');
}
