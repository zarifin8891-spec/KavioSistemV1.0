"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function positivePercent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function errorRedirect(message: string) {
  redirect(`/master/spk?error=${encodeURIComponent(message)}`);
}

const SPK_READY_STATUSES = ['AVAILABLE', 'BOOKING'] as const;

export async function createSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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

  const [{ data: kavling, error: kavlingError }, { data: kantor, error: kantorError }, { data: mandor, error: mandorError }, { data: activeSpk, error: activeSpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, id_tipe, status_aktif, status_kavling').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_kantor_pelaksana').select('id_kantor, status_aktif').eq('id_kantor', idKantor).maybeSingle(),
    supabase.from('master_mandor').select('id_mandor, id_kantor, status_aktif').eq('id_mandor', idMandor).maybeSingle(),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
  ]);

  if (kavlingError || kantorError || mandorError || activeSpkError) {
    errorRedirect((kavlingError ?? kantorError ?? mandorError ?? activeSpkError)?.message ?? 'Gagal membaca data relasi SPK');
  }

  if (!kavling || !kavling.status_aktif) errorRedirect('Kavling tidak ditemukan atau nonaktif');
  if (!kantor || !kantor.status_aktif) errorRedirect('Kantor/pelaksana tidak ditemukan atau nonaktif');
  if (!mandor || !mandor.status_aktif) errorRedirect('Mandor tidak ditemukan atau nonaktif');
  if (activeSpk) errorRedirect('Kavling tersebut sudah memiliki SPK aktif');
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

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) errorRedirect('ID SPK tidak valid');

  const { data: spk, error: spkError } = await supabase
    .from('spk')
    .select('id_spk, id_kavling, status_spk, is_active')
    .eq('id_spk', idSpk)
    .maybeSingle();
  if (spkError) errorRedirect(spkError.message);
  if (!spk || spk.status_spk !== 'DRAFT' || spk.is_active) errorRedirect('SPK tidak berada pada status DRAFT yang valid');

  const [{ data: config, error: configError }, { data: kavling, error: kavlingError }, { data: activeOtherSpk, error: activeOtherSpkError }] = await Promise.all([
    supabase.from('spk_progress_config').select('id_kategori, bobot_final').eq('id_spk', idSpk),
    supabase.from('master_kavling').select('id_kavling, status_aktif, status_kavling').eq('id_kavling', spk.id_kavling).maybeSingle(),
    supabase.from('spk').select('id_spk').eq('id_kavling', spk.id_kavling).eq('is_active', true).neq('id_spk', idSpk).maybeSingle(),
  ]);

  if (configError || kavlingError || activeOtherSpkError) errorRedirect((configError ?? kavlingError ?? activeOtherSpkError)?.message ?? 'Gagal memvalidasi SPK');
  if (!kavling || !kavling.status_aktif) errorRedirect('Kavling pada SPK tidak aktif atau tidak ditemukan');
  if (!(SPK_READY_STATUSES as readonly string[]).includes(kavling.status_kavling)) errorRedirect(`Kavling berstatus ${kavling.status_kavling} tidak siap untuk SPK`);
  if (activeOtherSpk) errorRedirect('Kavling tersebut sudah memiliki SPK aktif lain');

  const totalBobot = (config ?? []).reduce((sum, row) => sum + Number(row.bobot_final ?? 0), 0);
  if (!(config ?? []).length || Math.abs(totalBobot - 1) > 0.00001) errorRedirect(`SPK tidak dapat diaktifkan. Total bobot harus 100%, saat ini ${(totalBobot * 100).toFixed(2)}%`);

  const { error: updateError } = await supabase.from('spk').update({ status_spk: 'AKTIF', is_active: true }).eq('id_spk', idSpk).eq('status_spk', 'DRAFT').eq('is_active', false);
  if (updateError) errorRedirect(updateError.message);

  const { error: kavlingUpdateError } = await supabase.from('master_kavling').update({ status_kavling: 'BUILDING' }).eq('id_kavling', spk.id_kavling).eq('status_aktif', true);
  if (kavlingUpdateError) errorRedirect(kavlingUpdateError.message);

  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  redirect('/master/spk?success=SPK%20berhasil%20diaktifkan%20dan%20status%20kavling%20menjadi%20BUILDING');
}

export async function deactivateSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) errorRedirect('ID SPK tidak valid');

  const { data: spk, error: spkError } = await supabase.from('spk').select('id_spk, id_kavling, status_spk, is_active').eq('id_spk', idSpk).maybeSingle();
  if (spkError) errorRedirect(spkError.message);
  if (!spk || !spk.is_active) errorRedirect('SPK aktif tidak ditemukan');
  if (spk.status_spk !== 'AKTIF') errorRedirect('Hanya SPK AKTIF yang dapat ditandai selesai');

  const [{ data: activeSales, error: salesError }, { data: kavling, error: kavlingError }] = await Promise.all([
    supabase.from('sales').select('id_sales, status_sales').eq('id_kavling', spk.id_kavling).eq('is_active', true).maybeSingle(),
    supabase.from('master_kavling').select('status_kavling, status_aktif').eq('id_kavling', spk.id_kavling).maybeSingle(),
  ]);
  if (salesError || kavlingError) errorRedirect((salesError ?? kavlingError)?.message ?? 'Gagal membaca relasi SPK');
  if (!kavling || !kavling.status_aktif) errorRedirect('Kavling pada SPK tidak aktif atau tidak ditemukan');

  const { error } = await supabase.from('spk').update({ status_spk: 'SELESAI', is_active: false }).eq('id_spk', idSpk).eq('is_active', true).eq('status_spk', 'AKTIF');
  if (error) errorRedirect(error.message);

  let nextKavlingStatus = 'READY_STOCK';
  if (activeSales?.status_sales === 'AKAD') nextKavlingStatus = 'SOLD';
  else if (activeSales) nextKavlingStatus = 'BOOKING';

  const { error: kavlingErrorUpdate } = await supabase.from('master_kavling').update({ status_kavling: nextKavlingStatus }).eq('id_kavling', spk.id_kavling).eq('status_aktif', true);
  if (kavlingErrorUpdate) errorRedirect(kavlingErrorUpdate.message);

  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  redirect(`/master/spk?success=${encodeURIComponent(`SPK selesai. Status kavling menjadi ${nextKavlingStatus}`)}`);
}
