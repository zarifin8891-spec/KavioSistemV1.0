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

  const idKantor = text(formData.get('id_kantor'));
  const namaKantorPelaksana = text(formData.get('nama_kantor_pelaksana'));
  const penanggungJawab = text(formData.get('penanggung_jawab'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));

  if (!idKantor || !namaKantorPelaksana) {
    redirect('/master/kantor-pelaksana?error=ID%20dan%20nama%20kantor%20wajib%20diisi');
  }

  const { error } = await supabase.from('master_kantor_pelaksana').insert({
    id_kantor: idKantor,
    nama_kantor_pelaksana: namaKantorPelaksana,
    penanggung_jawab: penanggungJawab || null,
    no_hp: noHp || null,
    keterangan: keterangan || null,
    status_aktif: true,
  });

  if (error) redirect(`/master/kantor-pelaksana?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/kantor-pelaksana');
  redirect('/master/kantor-pelaksana?success=Kantor%20pelaksana%20berhasil%20ditambahkan');
}

export async function toggleKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKantor = text(formData.get('id_kantor'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKantor) redirect('/master/kantor-pelaksana?error=ID%20kantor%20tidak%20valid');

  const { error } = await supabase
    .from('master_kantor_pelaksana')
    .update({ status_aktif: !statusAktif })
    .eq('id_kantor', idKantor);

  if (error) redirect(`/master/kantor-pelaksana?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/kantor-pelaksana');
  revalidatePath('/master/mandor');
  redirect('/master/kantor-pelaksana');
}
