"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function createFail(message: string, focus = 'id_kantor'): never {
  redirectKavioFormError('/master/kantor-pelaksana', message, { form: 'master-kantor-create', focus });
}

function editFail(idKantor: string, message: string, focus = 'nama_kantor_pelaksana'): never {
  redirectKavioFormError('/master/kantor-pelaksana', message, { focus, params: { edit: idKantor } });
}

export async function createKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kantor-pelaksana?error=');

  const idKantor = text(formData.get('id_kantor'));
  const namaKantorPelaksana = text(formData.get('nama_kantor_pelaksana'));
  const penanggungJawab = text(formData.get('penanggung_jawab'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));

  if (!idKantor || !namaKantorPelaksana) {
    createFail('ID dan nama kantor wajib diisi', !idKantor ? 'id_kantor' : 'nama_kantor_pelaksana');
  }

  const { error } = await supabase.from('master_kantor_pelaksana').insert({
    id_kantor: idKantor,
    nama_kantor_pelaksana: namaKantorPelaksana,
    penanggung_jawab: penanggungJawab || null,
    no_hp: noHp || null,
    keterangan: keterangan || null,
    status_aktif: true,
  });

  if (error) createFail(error.message);

  revalidatePath('/master/kantor-pelaksana');
  redirect('/master/kantor-pelaksana?success=Kantor%20pelaksana%20berhasil%20ditambahkan');
}


export async function updateKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kantor-pelaksana?error=');

  const idKantor = text(formData.get('id_kantor'));
  const namaKantorPelaksana = text(formData.get('nama_kantor_pelaksana'));
  const penanggungJawab = text(formData.get('penanggung_jawab'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));
  if (!idKantor) redirectKavioFormError('/master/kantor-pelaksana', 'ID kantor tidak valid');
  if (!namaKantorPelaksana) editFail(idKantor, 'Nama kantor wajib diisi', 'nama_kantor_pelaksana');

  const { error } = await supabase.from('master_kantor_pelaksana').update({
    nama_kantor_pelaksana: namaKantorPelaksana,
    penanggung_jawab: penanggungJawab || null,
    no_hp: noHp || null,
    keterangan: keterangan || null,
  }).eq('id_kantor', idKantor);
  if (error) editFail(idKantor, error.message);

  revalidatePath('/master/kantor-pelaksana');
  revalidatePath('/master/mandor');
  revalidatePath('/master/spk');
  redirect('/master/kantor-pelaksana?success=Kantor%20pelaksana%20berhasil%20diperbarui');
}

export async function toggleKantorPelaksana(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kantor-pelaksana?error=');

  const idKantor = text(formData.get('id_kantor'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKantor) redirectKavioFormError('/master/kantor-pelaksana', 'ID kantor tidak valid');

  const { error } = await supabase
    .from('master_kantor_pelaksana')
    .update({ status_aktif: !statusAktif })
    .eq('id_kantor', idKantor);

  if (error) redirectKavioFormError('/master/kantor-pelaksana', error.message);

  revalidatePath('/master/kantor-pelaksana');
  revalidatePath('/master/mandor');
  redirect('/master/kantor-pelaksana');
}
