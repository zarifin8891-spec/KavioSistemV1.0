"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

export async function createKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const kodeKantor = text(formData.get('kode_kantor'));
  const namaKantor = text(formData.get('nama_kantor'));
  const statusAktif = text(formData.get('status_aktif')) !== 'false';

  if (!kodeKantor || !namaKantor) {
    redirect('/master/kantor-pelaksana?error=Kode%20dan%20nama%20kantor%20wajib%20diisi');
  }

  const { error } = await supabase.from('master_kantor_pelaksana').insert({
    kode_kantor: kodeKantor,
    nama_kantor: namaKantor,
    status_aktif: statusAktif,
  });

  if (error) redirect(`/master/kantor-pelaksana?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/kantor-pelaksana');
  redirect('/master/kantor-pelaksana?success=Kantor%20pelaksana%20berhasil%20ditambahkan');
}

export async function toggleKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const kodeKantor = text(formData.get('kode_kantor'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!kodeKantor) redirect('/master/kantor-pelaksana?error=Kode%20kantor%20tidak%20valid');

  const { error } = await supabase
    .from('master_kantor_pelaksana')
    .update({ status_aktif: !statusAktif })
    .eq('kode_kantor', kodeKantor);

  if (error) redirect(`/master/kantor-pelaksana?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/kantor-pelaksana');
  redirect('/master/kantor-pelaksana');
}
