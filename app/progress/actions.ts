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

  const { error } = await supabase.rpc('insert_progress_update_atomic', {
    p_id_spk: idSpk,
    p_id_kategori: idKategori,
    p_tanggal_update: tanggalUpdate,
    p_progress_percent: progressPercent,
    p_keterangan: keterangan || null,
  });

  if (error) progressError(idSpk, error.message);

  revalidatePath('/progress');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);
  redirect(`/master/spk/detail/${encodeURIComponent(idSpk)}`);
}

