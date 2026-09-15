"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

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

  const idTipe = text(formData.get('id_tipe'));
  const idKategori = text(formData.get('id_kategori'));
  const bobotPersen = number(formData.get('bobot_standar'));

  if (!idTipe || !idKategori) {
    redirect('/master/template-progress?error=Tipe%20rumah%20dan%20kategori%20wajib%20dipilih');
  }

  if (!Number.isFinite(bobotPersen) || bobotPersen < 0 || bobotPersen > 100) {
    redirect('/master/template-progress?error=Bobot%20harus%20bernilai%200-100%25');
  }

  const { data: tipe, error: tipeError } = await supabase
    .from('master_tipe_rumah')
    .select('id_tipe')
    .eq('id_tipe', idTipe)
    .eq('status_aktif', true)
    .maybeSingle();

  if (tipeError) redirect(`/master/template-progress?error=${encodeURIComponent(tipeError.message)}`);
  if (!tipe) redirect('/master/template-progress?error=Tipe%20rumah%20tidak%20ditemukan%20atau%20nonaktif');

  const { data: kategori, error: kategoriError } = await supabase
    .from('master_kategori_pekerjaan')
    .select('id_kategori')
    .eq('id_kategori', idKategori)
    .eq('status_aktif', true)
    .maybeSingle();

  if (kategoriError) redirect(`/master/template-progress?error=${encodeURIComponent(kategoriError.message)}`);
  if (!kategori) redirect('/master/template-progress?error=Kategori%20pekerjaan%20tidak%20ditemukan%20atau%20nonaktif');

  const { error } = await supabase.from('template_progress_tipe').upsert(
    {
      id_tipe: idTipe,
      id_kategori: idKategori,
      bobot_standar: bobotPersen / 100,
    },
    { onConflict: 'id_tipe,id_kategori' },
  );

  if (error) redirect(`/master/template-progress?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/template-progress');
  revalidatePath('/master/spk');
  redirect('/master/template-progress?success=Bobot%20template%20berhasil%20disimpan');
}
