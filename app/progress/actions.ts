"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireKavioAction } from '../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function percent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : NaN;
}

function progressError(idSpk: string, message: string, focus = 'progress_batch_first'): never {
  redirectKavioFormError('/progress', message, {
    form: 'progress-create',
    focus,
    params: { spk: idSpk, panel: 'progress' },
  });
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



export async function createProgressBatchUpdate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PROGRESS_WRITE', '/progress?error=');

  const idSpk = text(formData.get('id_spk'));
  const tanggalUpdate = text(formData.get('tanggal_update'));
  const rawEntries = text(formData.get('entries_json'));

  if (!idSpk || !tanggalUpdate || !rawEntries) {
    progressError(idSpk, 'SPK, tanggal, dan minimal satu progress wajib diisi', !tanggalUpdate ? 'tanggal_update' : 'progress_batch_first');
  }

  let entries: Array<{ id_item: string; progress_percent: number; keterangan?: string | null }> = [];
  try {
    const parsed = JSON.parse(rawEntries);
    if (!Array.isArray(parsed)||parsed.length>1000) throw new Error('INVALID_BATCH');
    if(parsed.some(row=>!row||!String(row.id_item??'').trim()||!Number.isFinite(Number(row.progress_percent))||Number(row.progress_percent)<=0||Number(row.progress_percent)>100))throw new Error('INVALID_ENTRY');
    entries = parsed
      .map((row) => ({
        id_item: String(row?.id_item ?? '').trim(),
        progress_percent: Number(row?.progress_percent),
        keterangan: String(row?.keterangan ?? '').trim() || null,
      }))
      .filter((row) => row.id_item && Number.isFinite(row.progress_percent) && row.progress_percent > 0);
  } catch {
    progressError(idSpk, 'Data progress batch tidak valid', 'progress_batch_first');
  }

  if (!entries.length) {
    progressError(idSpk, 'Isi minimal satu item pekerjaan sebelum menyimpan', 'progress_batch_first');
  }

  const {data:spk,error:spkError}=await supabase.from('spk').select('mode_progress').eq('id_spk',idSpk).maybeSingle();
  if(spkError||!spk)progressError(idSpk,spkError?.message??'SPK tidak ditemukan');
  const { data: inserted, error } = await supabase.rpc(spk.mode_progress==='PERINCIAN'?'insert_work_detail_progress_batch_atomic':'insert_progress_work_item_batch_atomic', {
    p_id_spk: idSpk,
    p_tanggal_update: tanggalUpdate,
    p_entries: entries,
  });

  if (error) {
    progressError(idSpk, error.message, 'progress_batch_first');
  }

  revalidatePath('/progress');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);

  const count = Number(inserted ?? entries.length);
  redirect(`/progress?spk=${encodeURIComponent(idSpk)}&success=${encodeURIComponent(`${count} item pekerjaan berhasil disimpan`)}`);
}
