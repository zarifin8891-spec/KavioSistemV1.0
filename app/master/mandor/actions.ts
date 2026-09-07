"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

export async function createMandor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idMandor = text(formData.get('id_mandor'));
  const namaMandor = text(formData.get('nama_mandor'));
  const idKantor = text(formData.get('id_kantor'));
  const noHp = text(formData.get('no_hp'));
  const keterangan = text(formData.get('keterangan'));

  if (!idMandor || !namaMandor || !idKantor) {
    redirect('/master/mandor?error=ID%20mandor%2C%20nama%20mandor%2C%20dan%20kantor%20wajib%20diisi');
  }

  const { error } = await supabase.from('master_mandor').insert({
    id_mandor: idMandor,
    nama_mandor: namaMandor,
    id_kantor: idKantor,
    no_hp: noHp || null,
    keterangan: keterangan || null,
    status_aktif: true,
  });

  if (error) redirect(`/master/mandor?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/mandor');
  redirect('/master/mandor?success=Mandor%20berhasil%20ditambahkan');
}

export async function toggleMandor(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idMandor = text(formData.get('id_mandor'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idMandor) redirect('/master/mandor?error=ID%20mandor%20tidak%20valid');

  const { error } = await supabase
    .from('master_mandor')
    .update({ status_aktif: !statusAktif })
    .eq('id_mandor', idMandor);

  if (error) redirect(`/master/mandor?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/mandor');
  redirect('/master/mandor');
}
