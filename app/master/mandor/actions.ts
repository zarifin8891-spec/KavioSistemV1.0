"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function createFail(message: string, focus = 'id_mandor'): never {
  redirectKavioFormError('/master/mandor', message, { form: 'master-mandor-create', focus });
}

function editFail(idMandor: string, message: string, focus = 'nama_mandor'): never {
  redirectKavioFormError('/master/mandor', message, { focus, params: { edit: idMandor } });
}

export async function createMandor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/mandor?error=');

  const idMandor = text(formData.get('id_mandor'));
  const namaMandor = text(formData.get('nama_mandor'));
  const idKantor = text(formData.get('id_kantor'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));

  if (!idMandor || !namaMandor || !idKantor) {
    createFail('ID mandor, nama mandor, dan kantor wajib diisi', !idMandor ? 'id_mandor' : !namaMandor ? 'nama_mandor' : 'id_kantor');
  }

  const { error } = await supabase.from('master_mandor').insert({
    id_mandor: idMandor,
    nama_mandor: namaMandor,
    id_kantor: idKantor,
    no_hp: noHp || null,
    keterangan: keterangan || null,
    status_aktif: true,
  });

  if (error) createFail(error.message);

  revalidatePath('/master/mandor');
  redirect('/master/mandor?success=Mandor%20berhasil%20ditambahkan');
}


export async function updateMandor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/mandor?error=');

  const idMandor = text(formData.get('id_mandor'));
  const namaMandor = text(formData.get('nama_mandor'));
  const idKantor = text(formData.get('id_kantor'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));
  if (!idMandor || !namaMandor || !idKantor) redirect('/master/mandor?error=ID%20mandor%2C%20nama%20mandor%2C%20dan%20kantor%20wajib%20diisi');

  const { error } = await supabase.from('master_mandor').update({
    nama_mandor: namaMandor,
    id_kantor: idKantor,
    no_hp: noHp || null,
    keterangan: keterangan || null,
  }).eq('id_mandor', idMandor);
  if (error) editFail(idMandor, error.message);

  revalidatePath('/master/mandor');
  revalidatePath('/master/spk');
  redirect('/master/mandor?success=Mandor%20berhasil%20diperbarui');
}

export async function toggleMandor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/mandor?error=');

  const idMandor = text(formData.get('id_mandor'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idMandor) redirectKavioFormError('/master/mandor', 'ID mandor tidak valid');

  const { error } = await supabase
    .from('master_mandor')
    .update({ status_aktif: !statusAktif })
    .eq('id_mandor', idMandor);

  if (error) redirectKavioFormError('/master/mandor', error.message);

  revalidatePath('/master/mandor');
  redirect('/master/mandor');
}
