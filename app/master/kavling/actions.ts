"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

export async function createKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKavling = text(formData.get('id_kavling'));
  const blok = text(formData.get('blok'));
  const noKavling = text(formData.get('no_kavling'));
  const idTipe = text(formData.get('id_tipe'));
  const statusKavling = text(formData.get('status_kavling')) || 'AVAILABLE';

  if (!idKavling || !blok || !noKavling || !idTipe) {
    redirect('/master/kavling?error=Data%20wajib%20belum%20lengkap');
  }

  const { error } = await supabase.from('master_kavling').insert({
    id_kavling: idKavling,
    blok,
    no_kavling: noKavling,
    id_tipe: idTipe,
    status_kavling: statusKavling,
    status_aktif: true,
  });

  if (error) {
    redirect(`/master/kavling?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/kavling');
  revalidatePath('/dashboard');
  redirect('/master/kavling?success=Kavling%20berhasil%20ditambahkan');
}

export async function toggleKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKavling = text(formData.get('id_kavling'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKavling) redirect('/master/kavling?error=ID%20kavling%20tidak%20valid');

  const { error } = await supabase
    .from('master_kavling')
    .update({ status_aktif: !statusAktif })
    .eq('id_kavling', idKavling);

  if (error) {
    redirect(`/master/kavling?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/master/kavling');
  revalidatePath('/dashboard');
  redirect('/master/kavling');
}
