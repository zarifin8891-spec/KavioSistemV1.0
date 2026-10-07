"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

const VALID_STATUS = ['AVAILABLE', 'BOOKING', 'SOLD', 'BUILDING', 'READY_STOCK', 'COMPLETED'] as const;
type KavlingStatus = (typeof VALID_STATUS)[number];

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function createError(message: string, focus = 'id_kavling'): never {
  redirectKavioFormError('/master/kavling', message, { form: 'master-kavling-create', focus });
}

function editError(idKavling: string, message: string, focus = 'blok'): never {
  redirectKavioFormError('/master/kavling', message, { focus, params: { edit: idKavling } });
}

function pageError(message: string): never {
  redirectKavioFormError('/master/kavling', message);
}

export async function createKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kavling?error=');

  const idKavling = text(formData.get('id_kavling'));
  const blok = text(formData.get('blok'));
  const noKavling = text(formData.get('no_kavling'));
  const idTipe = text(formData.get('id_tipe'));
  const luasTanahStandar = Number(formData.get('luas_tanah_standar') ?? 0);
  const luasTanahReal = Number(formData.get('luas_tanah_real') ?? 0);
  const hargaStandar = Number(formData.get('harga_standar') ?? 0);
  const hargaTanahMeter = Number(formData.get('harga_tanah_meter') ?? 0);
  const statusKavling = (text(formData.get('status_kavling')) || 'AVAILABLE') as KavlingStatus;

  if (!idKavling || !blok || !noKavling || !idTipe) {
    createError('Data wajib belum lengkap', !idKavling ? 'id_kavling' : !blok ? 'blok' : !noKavling ? 'no_kavling' : 'id_tipe');
  }
  if (!VALID_STATUS.includes(statusKavling)) createError('Status kavling tidak valid', 'status_kavling');
  if (![luasTanahStandar, luasTanahReal, hargaStandar, hargaTanahMeter].every(Number.isFinite)) {
    createError(
      'Data luas tanah atau harga tidak valid',
      !Number.isFinite(luasTanahStandar) ? 'luas_tanah_standar'
        : !Number.isFinite(luasTanahReal) ? 'luas_tanah_real'
          : !Number.isFinite(hargaStandar) ? 'harga_standar'
            : 'harga_tanah_meter',
    );
  }
  if (luasTanahStandar < 0 || luasTanahReal < luasTanahStandar) {
    createError('Luas tanah real harus lebih besar atau sama dengan luas tanah standar', 'luas_tanah_real');
  }
  if (hargaStandar < 0 || hargaTanahMeter < 0) {
    createError('Harga tidak boleh negatif', hargaStandar < 0 ? 'harga_standar' : 'harga_tanah_meter');
  }
  if (statusKavling === 'READY_STOCK') createError('READY_STOCK ditetapkan otomatis setelah SPK selesai', 'status_kavling');

  const [{ data: tipe, error: tipeError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('master_tipe_rumah').select('id_tipe, status_aktif').eq('id_tipe', idTipe).maybeSingle(),
    supabase.from('master_kavling').select('id_kavling').eq('id_kavling', idKavling).maybeSingle(),
  ]);

  if (tipeError || existingError) createError((tipeError ?? existingError)?.message ?? 'Gagal membaca data master', tipeError ? 'id_tipe' : 'id_kavling');
  if (!tipe || !tipe.status_aktif) createError('Tipe rumah tidak ditemukan atau nonaktif', 'id_tipe');
  if (existing) createError('ID kavling tersebut sudah digunakan', 'id_kavling');

  const { error } = await supabase.from('master_kavling').insert({
    id_kavling: idKavling,
    blok,
    no_kavling: noKavling,
    id_tipe: idTipe,
    status_kavling: statusKavling,
    status_aktif: true,
    luas_tanah_standar: luasTanahStandar,
    luas_tanah_real: luasTanahReal,
    harga_standar: hargaStandar,
    harga_tanah_meter: hargaTanahMeter,
  });

  if (error) createError(error.message, 'id_kavling');

  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  redirect('/master/kavling?success=Kavling%20berhasil%20ditambahkan');
}

export async function updateKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kavling?error=');

  const idKavling = text(formData.get('id_kavling'));
  const blok = text(formData.get('blok'));
  const noKavling = text(formData.get('no_kavling'));
  const idTipe = text(formData.get('id_tipe'));
  const luasTanahStandar = Number(formData.get('luas_tanah_standar') ?? 0);
  const luasTanahReal = Number(formData.get('luas_tanah_real') ?? 0);
  const hargaStandar = Number(formData.get('harga_standar') ?? 0);
  const hargaTanahMeter = Number(formData.get('harga_tanah_meter') ?? 0);

  if (!idKavling) pageError('ID kavling tidak valid');
  if (!blok || !noKavling || !idTipe) {
    editError(idKavling, 'Data wajib belum lengkap', !blok ? 'blok' : !noKavling ? 'no_kavling' : 'id_tipe');
  }
  if (![luasTanahStandar, luasTanahReal, hargaStandar, hargaTanahMeter].every(Number.isFinite)) {
    editError(
      idKavling,
      'Data luas tanah atau harga tidak valid',
      !Number.isFinite(luasTanahStandar) ? 'luas_tanah_standar'
        : !Number.isFinite(luasTanahReal) ? 'luas_tanah_real'
          : !Number.isFinite(hargaStandar) ? 'harga_standar'
            : 'harga_tanah_meter',
    );
  }
  if (luasTanahStandar < 0 || luasTanahReal < luasTanahStandar) {
    editError(idKavling, 'Luas tanah real harus lebih besar atau sama dengan luas tanah standar', 'luas_tanah_real');
  }
  if (hargaStandar < 0 || hargaTanahMeter < 0) {
    editError(idKavling, 'Harga tidak boleh negatif', hargaStandar < 0 ? 'harga_standar' : 'harga_tanah_meter');
  }

  const [{ data: kavling, error: kavlingError }, { data: tipe, error: tipeError }, { data: anySales, error: anySalesError }, { data: anySpk, error: anySpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_aktif').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_tipe_rumah').select('id_tipe,status_aktif').eq('id_tipe', idTipe).maybeSingle(),
    supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).limit(1),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).limit(1),
  ]);

  if (kavlingError || tipeError || anySalesError || anySpkError) {
    editError(idKavling, (kavlingError ?? tipeError ?? anySalesError ?? anySpkError)?.message ?? 'Gagal membaca relasi kavling', tipeError ? 'id_tipe' : 'blok');
  }
  if (!kavling) editError(idKavling, 'Kavling tidak ditemukan', 'blok');
  if (!kavling.status_aktif) editError(idKavling, 'Kavling nonaktif tidak dapat diedit', 'blok');
  if (!tipe || !tipe.status_aktif) editError(idKavling, 'Tipe rumah tidak ditemukan atau nonaktif', 'id_tipe');
  if (kavling.id_tipe !== idTipe && ((anySales ?? []).length > 0 || (anySpk ?? []).length > 0)) {
    editError(idKavling, 'Tipe rumah tidak dapat diubah karena kavling sudah memiliki histori Sales atau SPK', 'id_tipe');
  }

  const { error } = await supabase.from('master_kavling').update({
    blok,
    no_kavling: noKavling,
    id_tipe: idTipe,
    luas_tanah_standar: luasTanahStandar,
    luas_tanah_real: luasTanahReal,
    harga_standar: hargaStandar,
    harga_tanah_meter: hargaTanahMeter,
  }).eq('id_kavling', idKavling);

  if (error) editError(idKavling, error.message);

  revalidatePath('/master/kavling');
  revalidatePath('/master/sales');
  revalidatePath('/master/spk');
  revalidatePath('/siteplan');
  revalidatePath('/dashboard');
  redirect('/master/kavling?success=Data%20kavling%20berhasil%20diperbarui');
}

export async function toggleKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kavling?error=');

  const idKavling = text(formData.get('id_kavling'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKavling) pageError('ID kavling tidak valid');

  if (statusAktif) {
    const [{ data: activeSpk, error: spkError }, { data: activeSales, error: salesError }] = await Promise.all([
      supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
      supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).eq('status_aktif', true).maybeSingle(),
    ]);

    if (spkError || salesError) pageError((spkError ?? salesError)?.message ?? 'Gagal membaca relasi kavling');
    if (activeSpk) pageError('Kavling tidak boleh dinonaktifkan karena masih memiliki SPK aktif');
    if (activeSales) pageError('Kavling tidak boleh dinonaktifkan karena masih memiliki sales aktif');
  }

  const { error } = await supabase
    .from('master_kavling')
    .update({ status_aktif: !statusAktif })
    .eq('id_kavling', idKavling);

  if (error) pageError(error.message);

  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  redirect('/master/kavling?success=Status%20kavling%20berhasil%20diperbarui');
}
