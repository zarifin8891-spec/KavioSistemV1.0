"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function positivePercent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function errorRedirect(message: string): never {
  redirect(`/master/spk?error=${encodeURIComponent(message)}`);
}

const SPK_READY_STATUSES = ['AVAILABLE', 'BOOKING'] as const;

export async function createSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SPK_WRITE', '/master/spk?error=');

  const idKavling = text(formData.get('id_kavling'));
  const tglSpk = text(formData.get('tgl_spk'));
  const tglTargetSelesai = text(formData.get('tgl_target_selesai'));
  const idKantor = text(formData.get('id_kantor'));
  const idMandor = text(formData.get('id_mandor'));
  const jenisBobot = text(formData.get('jenis_bobot'));

  if (!idKavling || !tglSpk || !tglTargetSelesai || !idKantor || !idMandor || !['STANDAR', 'CUSTOM'].includes(jenisBobot)) {
    errorRedirect('Semua field utama SPK wajib diisi');
  }

  if (tglTargetSelesai < tglSpk) errorRedirect('Tanggal target selesai tidak boleh sebelum tanggal SPK');

  const [{ data: kavling, error: kavlingError }, { data: kantor, error: kantorError }, { data: mandor, error: mandorError }, { data: existingSpk, error: existingSpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, id_tipe, status_aktif, status_kavling').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_kantor_pelaksana').select('id_kantor, status_aktif').eq('id_kantor', idKantor).maybeSingle(),
    supabase.from('master_mandor').select('id_mandor, id_kantor, status_aktif').eq('id_mandor', idMandor).maybeSingle(),
    supabase.from('spk').select('id_spk,status_spk,is_active').eq('id_kavling', idKavling).maybeSingle(),
  ]);

  if (kavlingError || kantorError || mandorError || existingSpkError) {
    errorRedirect((kavlingError ?? kantorError ?? mandorError ?? existingSpkError)?.message ?? 'Gagal membaca data relasi SPK');
  }

  if (!kavling || !kavling.status_aktif) errorRedirect('Kavling tidak ditemukan atau nonaktif');
  if (!kantor || !kantor.status_aktif) errorRedirect('Kantor/pelaksana tidak ditemukan atau nonaktif');
  if (!mandor || !mandor.status_aktif) errorRedirect('Mandor tidak ditemukan atau nonaktif');
  if (existingSpk?.is_active) errorRedirect('Kavling tersebut sudah memiliki SPK aktif');
  if (existingSpk && existingSpk.status_spk !== 'DRAFT') errorRedirect(`Kavling tersebut sudah memiliki SPK dengan status ${existingSpk.status_spk}. Satu kavling hanya boleh memiliki satu SPK.`);
  if (mandor.id_kantor !== idKantor) errorRedirect('Mandor harus berasal dari kantor pelaksana yang dipilih');
  if (!(SPK_READY_STATUSES as readonly string[]).includes(kavling.status_kavling)) {
    errorRedirect(`Kavling berstatus ${kavling.status_kavling} tidak dapat dibuatkan SPK baru`);
  }

  const { data: templates, error: templateError } = await supabase
    .from('template_progress_tipe')
    .select('id_tipe, id_kategori, bobot_standar')
    .eq('id_tipe', kavling.id_tipe)
    .order('id_kategori');

  if (templateError) errorRedirect(templateError.message);

  const templateRows = templates ?? [];
  if (!templateRows.length) errorRedirect('Tipe rumah kavling belum memiliki template progress');

  const config = jenisBobot === 'STANDAR'
    ? templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: Number(row.bobot_standar) }))
    : templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: positivePercent(formData.get(`bobot_${row.id_kategori}`)) / 100 }));

  if (config.some((row) => !Number.isFinite(row.bobot_final) || row.bobot_final < 0 || row.bobot_final > 1)) {
    errorRedirect('Semua bobot custom harus berupa angka 0 sampai 100');
  }

  const totalBobot = config.reduce((total, row) => total + row.bobot_final, 0);
  if (Math.abs(totalBobot - 1) > 0.00001) {
    errorRedirect(`Total bobot harus 100%. Saat ini ${(totalBobot * 100).toFixed(2)}%`);
  }

  if (existingSpk) {
    const { error: deleteConfigError } = await supabase
      .from('spk_progress_config')
      .delete()
      .eq('id_spk', existingSpk.id_spk);

    if (deleteConfigError) errorRedirect(deleteConfigError.message);

    const { error: configError } = await supabase.from('spk_progress_config').insert(
      config.map((row) => ({ id_spk: existingSpk.id_spk, id_kategori: row.id_kategori, bobot_final: row.bobot_final })),
    );

    if (configError) errorRedirect(configError.message);

    const { error: updateError } = await supabase
      .from('spk')
      .update({
        tgl_spk: tglSpk,
        id_tipe: kavling.id_tipe,
        jenis_bobot: jenisBobot,
        id_kantor: idKantor,
        id_mandor: idMandor,
        status_spk: 'AKTIF',
        tgl_target_selesai: tglTargetSelesai,
        is_active: true,
      })
      .eq('id_spk', existingSpk.id_spk)
      .eq('status_spk', 'DRAFT')
      .eq('is_active', false);

    if (updateError) errorRedirect(updateError.message);

    const { error: kavlingUpdateError } = await supabase
      .from('master_kavling')
      .update({ status_kavling: 'BUILDING' })
      .eq('id_kavling', idKavling)
      .eq('status_aktif', true);

    if (kavlingUpdateError) errorRedirect(kavlingUpdateError.message);

    revalidatePath('/master/spk');
    revalidatePath('/master/kavling');
    revalidatePath('/master/sales');
    revalidatePath('/dashboard');
    revalidatePath(`/master/spk/detail/${existingSpk.id_spk}`);
    redirect('/master/spk?success=SPK%20DRAFT%20berhasil%20diperbarui%20dan%20diaktifkan');
  }

  const { data: spk, error: spkError } = await supabase
    .from('spk')
    .insert({
      id_kavling: idKavling,
      tgl_spk: tglSpk,
      id_tipe: kavling.id_tipe,
      jenis_bobot: jenisBobot,
      id_kantor: idKantor,
      id_mandor: idMandor,
      status_spk: 'DRAFT',
      tgl_target_selesai: tglTargetSelesai,
      is_active: false,
    })
    .select('id_spk')
    .single();

  if (spkError || !spk) errorRedirect(spkError?.message ?? 'SPK gagal dibuat');

  const { error: configError } = await supabase.from('spk_progress_config').insert(
    config.map((row) => ({ id_spk: spk.id_spk, id_kategori: row.id_kategori, bobot_final: row.bobot_final })),
  );

  if (configError) {
    await supabase.from('spk').delete().eq('id_spk', spk.id_spk);
    errorRedirect(configError.message);
  }

  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect('/master/spk?success=SPK%20berhasil%20dibuat%20sebagai%20DRAFT');
}

export async function activateSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SPK_WRITE', '/master/spk?error=');

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) errorRedirect('ID SPK tidak valid');

  const { error } = await supabase.rpc('activate_spk_atomic', { p_id_spk: idSpk });
  if (error) errorRedirect(error.message);

  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);
  redirect('/master/spk?success=SPK%20berhasil%20diaktifkan%20dan%20status%20kavling%20menjadi%20BUILDING');
}

export async function deactivateSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SPK_WRITE', '/master/spk?error=');

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) errorRedirect('ID SPK tidak valid');

  const { data: nextStatus, error } = await supabase.rpc('deactivate_spk_atomic', { p_id_spk: idSpk });
  if (error) errorRedirect(error.message);

  const finalStatus = String(nextStatus ?? 'READY_STOCK');
  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);
  redirect(`/master/spk?success=${encodeURIComponent(`SPK selesai. Status kavling menjadi ${finalStatus}`)}`);
}
