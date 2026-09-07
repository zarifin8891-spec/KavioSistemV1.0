"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function percent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : NaN;
}

export async function createProgressUpdate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idSpk = text(formData.get('id_spk'));
  const idKategori = text(formData.get('id_kategori'));
  const tanggalUpdate = text(formData.get('tanggal_update'));
  const progressPercent = percent(formData.get('progress_periode'));
  const keterangan = text(formData.get('keterangan'));

  if (!idSpk || !idKategori || !tanggalUpdate || !Number.isFinite(progressPercent)) {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=SPK%2C%20kategori%2C%20tanggal%2C%20dan%20progress%20periode%200-100%25%20wajib%20diisi`);
  }

  const [{ data: spk, error: spkError }, { data: config, error: configError }, { data: duplicate, error: duplicateError }] = await Promise.all([
    supabase.from('spk').select('id_spk, id_kavling, tgl_spk, status_spk, is_active').eq('id_spk', idSpk).maybeSingle(),
    supabase.from('spk_progress_config').select('id_kategori, bobot_final').eq('id_spk', idSpk).eq('id_kategori', idKategori).maybeSingle(),
    supabase.from('progress_update').select('id_progress').eq('id_spk', idSpk).eq('tanggal_update', tanggalUpdate).eq('id_kategori', idKategori).maybeSingle(),
  ]);

  if (spkError || configError || duplicateError) {
    const message = (spkError ?? configError ?? duplicateError)?.message ?? 'Gagal membaca data SPK';
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=${encodeURIComponent(message)}`);
  }

  if (!spk || !spk.is_active || spk.status_spk !== 'AKTIF') {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=SPK%20tidak%20aktif%20atau%20tidak%20ditemukan`);
  }

  if (tanggalUpdate < spk.tgl_spk) {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=Tanggal%20update%20tidak%20boleh%20sebelum%20tanggal%20SPK`);
  }

  if (!config) {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=Kategori%20tersebut%20tidak%20terdaftar%20pada%20konfigurasi%20SPK`);
  }

  if (duplicate) {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=Progress%20untuk%20kategori%20dan%20tanggal%20tersebut%20sudah%20ada`);
  }

  const { error } = await supabase.from('progress_update').insert({
    id_spk: idSpk,
    tanggal_update: tanggalUpdate,
    id_kategori: idKategori,
    progress_periode: progressPercent / 100,
    keterangan: keterangan || null,
    input_by: user.id,
  });

  if (error) {
    redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/progress');
  revalidatePath('/dashboard');
  redirect(`/progress?spk=${encodeURIComponent(idSpk)}&success=Progress%20periode%20berhasil%20disimpan`);
}
