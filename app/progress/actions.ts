"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireKavioAction } from '../../lib/kavio-permissions-server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function percent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : NaN;
}

function progressError(idSpk: string, message: string): never {
  redirect(`/progress?spk=${encodeURIComponent(idSpk)}&error=${encodeURIComponent(message)}`);
}

export async function createProgressUpdate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PROGRESS_WRITE', '/progress?error=');

  const idSpk = text(formData.get('id_spk'));
  const idKategori = text(formData.get('id_kategori'));
  const tanggalUpdate = text(formData.get('tanggal_update'));
  const progressPercent = percent(formData.get('progress_periode'));
  const keterangan = text(formData.get('keterangan'));

  if (!idSpk || !idKategori || !tanggalUpdate || !Number.isFinite(progressPercent)) {
    progressError(idSpk, 'SPK, kategori, tanggal, dan progress periode 0-100% wajib diisi');
  }

  const [{ data: spk, error: spkError }, { data: config, error: configError }, { data: allConfig, error: allConfigError }, { data: current, error: currentError }, { data: duplicate, error: duplicateError }] = await Promise.all([
    supabase.from('spk').select('id_spk, id_kavling, id_tipe, tgl_spk, status_spk, is_active').eq('id_spk', idSpk).maybeSingle(),
    supabase.from('spk_progress_config').select('id_kategori, bobot_final').eq('id_spk', idSpk).eq('id_kategori', idKategori).maybeSingle(),
    supabase.from('spk_progress_config').select('id_kategori, bobot_final').eq('id_spk', idSpk),
    supabase.from('v_progress_kategori_current').select('id_kategori, progress_akumulasi').eq('id_spk', idSpk).eq('id_kategori', idKategori).maybeSingle(),
    supabase.from('progress_update').select('id_progress').eq('id_spk', idSpk).eq('tanggal_update', tanggalUpdate).eq('id_kategori', idKategori).maybeSingle(),
  ]);

  if (spkError || configError || allConfigError || currentError || duplicateError) {
    const message = (spkError ?? configError ?? allConfigError ?? currentError ?? duplicateError)?.message ?? 'Gagal membaca data SPK';
    progressError(idSpk, message);
  }

  if (!spk || !spk.is_active || spk.status_spk !== 'AKTIF') {
    progressError(idSpk, 'SPK tidak aktif atau tidak ditemukan');
  }

  if (tanggalUpdate < spk.tgl_spk) {
    progressError(idSpk, 'Tanggal update tidak boleh sebelum tanggal SPK');
  }

  if (!config) {
    progressError(idSpk, 'Kategori tersebut tidak terdaftar pada konfigurasi SPK');
  }

  const configRows = allConfig ?? [];
  const totalBobot = configRows.reduce((sum, row) => sum + Number(row.bobot_final ?? 0), 0);
  if (!configRows.length || configRows.some((row) => !Number.isFinite(Number(row.bobot_final)) || Number(row.bobot_final) < 0 || Number(row.bobot_final) > 1) || Math.abs(totalBobot - 1) > 0.00001) {
    progressError(idSpk, `Konfigurasi bobot SPK tidak valid. Total saat ini ${(totalBobot * 100).toFixed(2)}%`);
  }

  if (Number(current?.progress_akumulasi ?? 0) >= 1 - 0.000001) {
    progressError(idSpk, 'Kategori tersebut sudah mencapai 100% dan tidak dapat ditambahkan progress lagi');
  }

  if (duplicate) {
    progressError(idSpk, 'Progress untuk kategori dan tanggal tersebut sudah ada');
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
    progressError(idSpk, error.code === '23505' ? 'Progress untuk kategori dan tanggal tersebut sudah ada' : error.message);
  }

  revalidatePath('/progress');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);
  redirect(`/master/spk/detail/${encodeURIComponent(idSpk)}`);
}
