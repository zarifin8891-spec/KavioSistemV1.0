"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function number(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function upsertTemplateProgress(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/template-progress?error=');

  const idTipe = text(formData.get('id_tipe'));
  const idKategori = text(formData.get('id_kategori'));
  const bobotPersen = number(formData.get('bobot_standar'));

  if (!idTipe || !idKategori) {
    redirectKavioFormError('/master/template-progress', 'Tipe rumah dan kategori wajib dipilih', { form: 'master-template-progress', focus: 'id_tipe' });
  }

  if (!Number.isFinite(bobotPersen) || bobotPersen < 0 || bobotPersen > 100) {
    redirectKavioFormError('/master/template-progress', 'Bobot harus bernilai 0-100%', { form: 'master-template-progress', focus: 'bobot_standar' });
  }

  const { data: tipe, error: tipeError } = await supabase
    .from('master_tipe_rumah')
    .select('id_tipe')
    .eq('id_tipe', idTipe)
    .eq('status_aktif', true)
    .maybeSingle();

  if (tipeError) redirectKavioFormError('/master/template-progress', tipeError.message, { form: 'master-template-progress', focus: 'id_tipe' });
  if (!tipe) redirectKavioFormError('/master/template-progress', 'Tipe rumah tidak ditemukan atau nonaktif', { form: 'master-template-progress', focus: 'id_tipe' });

  const { data: kategori, error: kategoriError } = await supabase
    .from('master_kategori_pekerjaan')
    .select('id_kategori')
    .eq('id_kategori', idKategori)
    .eq('status_aktif', true)
    .maybeSingle();

  if (kategoriError) redirectKavioFormError('/master/template-progress', kategoriError.message, { form: 'master-template-progress', focus: 'id_kategori' });
  if (!kategori) redirectKavioFormError('/master/template-progress', 'Kategori pekerjaan tidak ditemukan atau nonaktif', { form: 'master-template-progress', focus: 'id_kategori' });

  const { error } = await supabase.from('template_progress_tipe').upsert(
    {
      id_tipe: idTipe,
      id_kategori: idKategori,
      bobot_standar: bobotPersen / 100,
    },
    { onConflict: 'id_tipe,id_kategori' },
  );

  if (error) redirectKavioFormError('/master/template-progress', error.message, { form: 'master-template-progress', focus: 'bobot_standar' });

  revalidatePath('/master/template-progress');
  revalidatePath('/master/spk');
  redirect('/master/template-progress?success=Bobot%20template%20berhasil%20disimpan');
}
