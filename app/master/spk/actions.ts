"use server";

import {SPK_KAVLING_START_STATUSES} from '../../lib/spk-eligibility';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';
import {workTotalPercent} from '../../lib/work-detail';
import {fasumAutoWeights} from '../../lib/fasum-wages';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function positivePercent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
}

function createError(message: string, focus = 'id_kavling'): never {
  redirectKavioFormError('/master/spk', message, { form: 'spk-create', focus });
}

function pageError(message: string): never {
  redirectKavioFormError('/master/spk', message);
}

function fasumError(message: string, focus = 'nama_objek'): never {
  redirectKavioFormError('/master/spk', message, { form: 'spk-fasum-create', focus });
}



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
    createError(
      'Semua field utama SPK wajib diisi',
      !idKavling ? 'id_kavling'
        : !['STANDAR', 'CUSTOM'].includes(jenisBobot) ? 'jenis_bobot'
          : !tglSpk ? 'tgl_spk'
            : !tglTargetSelesai ? 'tgl_target_selesai'
              : !idKantor ? 'id_kantor'
                : 'id_mandor',
    );
  }

  if (tglTargetSelesai < tglSpk) createError('Tanggal target selesai tidak boleh sebelum tanggal SPK', 'tgl_target_selesai');

  const [{ data: kavling, error: kavlingError }, { data: kantor, error: kantorError }, { data: mandor, error: mandorError }, { data: existingSpk, error: existingSpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, id_tipe, status_aktif, status_kavling').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_kantor_pelaksana').select('id_kantor, status_aktif').eq('id_kantor', idKantor).maybeSingle(),
    supabase.from('master_mandor').select('id_mandor, id_kantor, status_aktif').eq('id_mandor', idMandor).maybeSingle(),
    supabase.from('spk').select('id_spk,status_spk,is_active').eq('id_kavling', idKavling).maybeSingle(),
  ]);

  if (kavlingError || kantorError || mandorError || existingSpkError) {
    createError(
      (kavlingError ?? kantorError ?? mandorError ?? existingSpkError)?.message ?? 'Gagal membaca data relasi SPK',
      kavlingError || existingSpkError ? 'id_kavling' : kantorError ? 'id_kantor' : 'id_mandor',
    );
  }

  if (!kavling || !kavling.status_aktif) createError('Kavling tidak ditemukan atau nonaktif', 'id_kavling');
  if (!kantor || !kantor.status_aktif) createError('Kantor/pelaksana tidak ditemukan atau nonaktif', 'id_kantor');
  if (!mandor || !mandor.status_aktif) createError('Mandor tidak ditemukan atau nonaktif', 'id_mandor');
  if (existingSpk?.is_active) createError('Kavling tersebut sudah memiliki SPK aktif', 'id_kavling');
  if (existingSpk && existingSpk.status_spk !== 'DRAFT') {
    createError(`Kavling tersebut sudah memiliki SPK dengan status ${existingSpk.status_spk}. Satu kavling hanya boleh memiliki satu SPK.`, 'id_kavling');
  }
  if (mandor.id_kantor !== idKantor) createError('Mandor harus berasal dari kantor pelaksana yang dipilih', 'id_mandor');
  if (!(SPK_KAVLING_START_STATUSES as readonly string[]).includes(kavling.status_kavling)) {
    createError(`Kavling berstatus ${kavling.status_kavling} tidak dapat dibuatkan SPK baru`, 'id_kavling');
  }

  const { data: templates, error: templateError } = await supabase
    .from('template_progress_tipe')
    .select('id_tipe, id_kategori, bobot_standar')
    .eq('id_tipe', kavling.id_tipe)
    .order('id_kategori');

  if (templateError) createError(templateError.message, 'id_kavling');

  const templateRows = templates ?? [];
  if (!templateRows.length) createError('Tipe rumah kavling belum memiliki template progress', 'id_kavling');

  const config = jenisBobot === 'STANDAR'
    ? templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: Number(row.bobot_standar) }))
    : templateRows.map((row) => ({ id_kategori: row.id_kategori, bobot_final: positivePercent(formData.get(`bobot_${row.id_kategori}`)) / 100 }));

  const invalidConfigIndex = config.findIndex((row) => !Number.isFinite(row.bobot_final) || row.bobot_final < 0 || row.bobot_final > 1);
  if (invalidConfigIndex >= 0) {
    createError('Semua bobot custom harus berupa angka 0 sampai 100', `bobot_${config[invalidConfigIndex].id_kategori}`);
  }

  const totalBobot = workTotalPercent(config.map(row=>({bobot:row.bobot_final})));
  if (totalBobot !== 100) {
    createError(
      `Total bobot setelah pembulatan harus 100,00%. Saat ini ${totalBobot.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}%`,
      jenisBobot === 'CUSTOM' && config[0] ? `bobot_${config[0].id_kategori}` : 'jenis_bobot',
    );
  }

  const { data: writeResult, error: writeError } = await supabase.rpc('create_or_update_spk_atomic', {
    p_id_kavling: idKavling,
    p_tgl_spk: tglSpk,
    p_tgl_target_selesai: tglTargetSelesai,
    p_id_kantor: idKantor,
    p_id_mandor: idMandor,
    p_jenis_bobot: jenisBobot,
    p_config: config,
  });

  if (writeError) createError(writeError.message, 'id_kavling');

  const result = (writeResult ?? {}) as { id_spk?: string; status_spk?: string };
  const idSpk = result.id_spk;
  const statusSpk = result.status_spk ?? 'DRAFT';

  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/siteplan');
  revalidatePath('/dashboard');
  if (idSpk) revalidatePath(`/master/spk/detail/${idSpk}`);

  if (idSpk) redirect(`/master/spk/konfigurasi?id=${encodeURIComponent(idSpk)}&success=SPK+draft+tersimpan.+Periksa+konfigurasi+pekerjaan+sebelum+aktivasi.`);
  redirect(statusSpk === 'AKTIF'
    ? '/master/spk?success=SPK%20DRAFT%20berhasil%20diperbarui%20dan%20diaktifkan'
    : '/master/spk?success=SPK%20berhasil%20dibuat%20sebagai%20DRAFT');
}

export async function createFasumSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SPK_WRITE', '/master/spk?error=');

  const namaObjek = text(formData.get('nama_objek'));
  const tglSpk = text(formData.get('tgl_spk'));
  const tglTargetSelesai = text(formData.get('tgl_target_selesai'));
  const idKantor = text(formData.get('id_kantor'));
  const idMandor = text(formData.get('id_mandor'));
  let items: Array<{nama_pekerjaan:string;bobot:number;volume:number;satuan:string;harga_satuan_upah:number;keterangan:string}> = [];
  try {
    const rawItems = JSON.parse(text(formData.get('items_json')));
    if (!Array.isArray(rawItems)) throw new Error('INVALID_ITEMS');
    items = rawItems.map((item) => ({
      nama_pekerjaan: String(item?.nama_pekerjaan ?? '').trim(),
      bobot: Number(item?.bobot),
      volume:Number(item?.volume),satuan:String(item?.satuan??'').trim(),harga_satuan_upah:Number(item?.harga_satuan_upah),keterangan:String(item?.keterangan??'').trim(),
    }));
  } catch {
    fasumError('Rincian item pekerjaan Fasum tidak valid');
  }

  if (!namaObjek || !tglSpk || !tglTargetSelesai || !idKantor || !idMandor || !items.length) {
    fasumError('Nama objek, tanggal, kantor, mandor, dan item pekerjaan wajib diisi');
  }
  if (tglTargetSelesai < tglSpk) fasumError('Tanggal target selesai tidak boleh sebelum tanggal SPK', 'tgl_target_selesai');
  if(items.some(i=>!i.nama_pekerjaan||!Number.isFinite(i.volume)||i.volume<=0||i.volume>9999999999||Math.abs(i.volume*100-Math.round(i.volume*100))>0.000001||!i.satuan||i.satuan.length>30||!Number.isFinite(i.harga_satuan_upah)||i.harga_satuan_upah<=0||i.harga_satuan_upah>999999999999||i.keterangan.length>500))fasumError('Isi nama, volume positif dengan maksimal dua desimal, satuan, dan harga satuan upah yang valid.');
  const weights=fasumAutoWeights(items);
  items=items.map((item,index)=>({...item,bobot:weights[index]}));
  if(items.some(i=>i.bobot<=0)||workTotalPercent(items)!==100)fasumError('Nilai upah setiap item harus cukup untuk menghasilkan bobot positif dengan total 100%.');

  const { data: idSpk, error } = await supabase.rpc('create_fasum_spk_with_wages_atomic', {
    p_nama_objek: namaObjek,
    p_tgl_spk: tglSpk,
    p_tgl_target_selesai: tglTargetSelesai,
    p_id_kantor: idKantor,
    p_id_mandor: idMandor,
    p_items: items,
  });
  if (error) fasumError(error.message);

  revalidatePath('/master/spk');
  revalidatePath('/progress');
  revalidatePath('/dashboard');
  redirect(`/master/spk/konfigurasi?id=${encodeURIComponent(String(idSpk))}&success=${encodeURIComponent(`SPK Fasum ${namaObjek} tersimpan sebagai DRAFT (${String(idSpk).slice(0, 8)})`)}`);
}

export async function activateSpk(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SPK_WRITE', '/master/spk?error=');

  const idSpk = text(formData.get('id_spk'));
  if (!idSpk) pageError('ID SPK tidak valid');

  const { error } = await supabase.rpc('activate_spk_atomic', { p_id_spk: idSpk });
  if (error) pageError(error.message);

  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/siteplan');
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
  if (!idSpk) pageError('ID SPK tidak valid');

  const { data: nextStatus, error } = await supabase.rpc('deactivate_spk_atomic', { p_id_spk: idSpk });
  if(error)redirectKavioFormError('/master/spk',error.message,{focus:'spk_finish:'+idSpk});

  const finalStatus = String(nextStatus ?? 'READY_STOCK');
  revalidatePath('/master/spk');
  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/siteplan');
  revalidatePath('/dashboard');
  revalidatePath(`/master/spk/detail/${idSpk}`);
  redirect(`/master/spk?success=${encodeURIComponent(`SPK selesai. Status kavling menjadi ${finalStatus}`)}`);
}
