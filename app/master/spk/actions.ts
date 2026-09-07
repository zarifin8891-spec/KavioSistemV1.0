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
    redirect('/master/spk?error=Semua%20field%20utama%20SPK%20wajib%20diisi');
  }

  if (tglTargetSelesai < tglSpk) {
    redirect('/master/spk?error=Tanggal%20target%20selesai%20tidak%20boleh%20sebelum%20tanggal%20SPK');
  }

  const [{ data: kavling, error: kavlingError }, { data: mandor, error: mandorError }, { data: activeSpk, error: activeSpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, id_tipe, status_aktif').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_mandor').select('id_mandor, id_kantor, status_aktif').eq('id_mandor', idMandor).maybeSingle(),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
  ]);

  if (kavlingError || activeSpkError) {
    redirect(`/master/spk?error=${encodeURIComponent((kavlingError ?? activeSpkError)?.message ?? 'Gagal membaca data')}`);
  }

  if (!kavling || !kavling.status_aktif) {
    redirect('/master/spk?error=Kavling%20tidak%20ditemukan%20atau%20nonaktif');
  }

  if (activeSpk) {
    redirect('/master/spk?error=Kavling%20tersebut%20sudah%20memiliki%20SPK%20aktif');
  }

  if (mandorError) {
    redirect(`/master/spk?error=${encodeURIComponent(mandorError.message)}`);
  }

  if (!mandor || !mandor.status_aktif) {
    redirect('/master/spk?error=Mandor%20tidak%20ditemukan%20atau%20nonaktif');
  }

  if (mandor.id_kantor !== idKantor) {
    redirect('/master/spk?error=Mandor%20harus%20berasal%20dari%20kantor%20pelaksana%20yang%20dipilih');
  }

  const { data: templates, error: templateError } = await supabase
    .from('template_progress_tipe')
    .select('id_tipe, id_kategori, bobot_standar')
    .eq('id_tipe', kavling.id_tipe)
    .order('id_kategori');

  if (templateError) redirect(`/master/spk?error=${encodeURIComponent(templateError.message)}`);

  const templateRows = templates ?? [];
  if (!templateRows.length) {
    redirect('/master/spk?error=Tipe%20rumah%20kavling%20belum%20memiliki%20template%20progress');
  }

  const config = jenisBobot === 'STANDAR'
    ? templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: Number(row.bobot_standar) }))
    : templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: positivePercent(formData.get(`bobot_${row.id_kategori}`)) / 100 }));

  if (config.some((row) => !Number.isFinite(row.bobot_final) || row.bobot_final < 0 || row.bobot_final > 1)) {
    redirect('/master/spk?error=Semua%20bobot%20custom%20harus%20berupa%20angka%200%20sampai%20100');
  }

  const totalBobot = config.reduce((total, row) => total + row.bobot_final, 0);
  if (Math.abs(totalBobot - 1) > 0.00001) {
    redirect(`/master/spk?error=Total%20bobot%20harus%20100%25.%20Saat%20ini%20${encodeURIComponent((totalBobot * 100).toFixed(2))}%25`);
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

  if (spkError || !spk) {
    redirect(`/master/spk?error=${encodeURIComponent(spkError?.message ?? 'SPK gagal dibuat')}`);
  }

  const { error: configError } = await supabase.from('spk_progress_config').insert(
    config.map((row) => ({
      id_spk: spk.id_spk,
      id_kategori: row.id_kategori,
      bobot_final: row.bobot_final,
    })),
  );

  if (configError) {
    await supabase.from('spk').delete().eq('id_spk', spk.id_spk);
    redirect(`/master/spk?error=${encodeURIComponent(configError.message)}`);
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
  if (!idSpk) redirect('/master/spk?error=ID%20SPK%20tidak%20valid');

  const { error } = await supabase
    .from('spk')
    .update({ status_spk: 'AKTIF', is_active: true })
    .eq('id_spk', idSpk)
    .eq('status_spk', 'DRAFT')
    .eq('is_active', false);

  if (error) redirect(`/master/spk?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect('/master/spk?success=SPK%20berhasil%20diaktifkan');
}

export async function deactivateSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) redirect('/master/spk?error=ID%20SPK%20tidak%20valid');

  const { error } = await supabase
    .from('spk')
    .update({ status_spk: 'SELESAI', is_active: false })
    .eq('id_spk', idSpk)
    .eq('is_active', true);

  if (error) redirect(`/master/spk?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect('/master/spk?success=SPK%20ditandai%20selesai%20dan%20dinonaktifkan');
}
