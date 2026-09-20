"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

const VALID_STATUS = ['AVAILABLE', 'BOOKING', 'SOLD', 'BUILDING', 'READY_STOCK', 'COMPLETED'] as const;
type KavlingStatus = (typeof VALID_STATUS)[number];

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

function errorRedirect(message: string) {
  redirect(`/master/kavling?error=${encodeURIComponent(message)}`);
}

export async function createKavling(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKavling = text(formData.get('id_kavling'));
  const blok = text(formData.get('blok'));
  const noKavling = text(formData.get('no_kavling'));
  const idTipe = text(formData.get('id_tipe'));
  const luasTanahStandar = Number(formData.get('luas_tanah_standar') ?? 0);
  const luasTanahReal = Number(formData.get('luas_tanah_real') ?? 0);
  const hargaStandar = Number(formData.get('harga_standar') ?? 0);
  const hargaTanahMeter = Number(formData.get('harga_tanah_meter') ?? 0);
  const statusKavling = (text(formData.get('status_kavling')) || 'AVAILABLE') as KavlingStatus;

  if (!idKavling || !blok || !noKavling || !idTipe) errorRedirect('Data wajib belum lengkap');
  if (!VALID_STATUS.includes(statusKavling)) errorRedirect('Status kavling tidak valid');
  if (![luasTanahStandar, luasTanahReal, hargaStandar, hargaTanahMeter].every(Number.isFinite)) errorRedirect('Data luas tanah atau harga tidak valid');
  if (luasTanahStandar < 0 || luasTanahReal < luasTanahStandar) errorRedirect('Luas tanah real harus lebih besar atau sama dengan luas tanah standar');
  if (hargaStandar < 0 || hargaTanahMeter < 0) errorRedirect('Harga tidak boleh negatif');
  if (statusKavling === 'READY_STOCK') errorRedirect('READY_STOCK ditetapkan otomatis setelah SPK selesai');

  const [{ data: tipe, error: tipeError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('master_tipe_rumah').select('id_tipe, status_aktif').eq('id_tipe', idTipe).maybeSingle(),
    supabase.from('master_kavling').select('id_kavling').eq('id_kavling', idKavling).maybeSingle(),
  ]);

  if (tipeError || existingError) errorRedirect((tipeError ?? existingError)?.message ?? 'Gagal membaca data master');
  if (!tipe || !tipe.status_aktif) errorRedirect('Tipe rumah tidak ditemukan atau nonaktif');
  if (existing) errorRedirect('ID kavling tersebut sudah digunakan');

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

  if (error) errorRedirect(error.message);

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

  const idKavling = text(formData.get('id_kavling'));
  const blok = text(formData.get('blok'));
  const noKavling = text(formData.get('no_kavling'));
  const idTipe = text(formData.get('id_tipe'));
  const luasTanahStandar = Number(formData.get('luas_tanah_standar') ?? 0);
  const luasTanahReal = Number(formData.get('luas_tanah_real') ?? 0);
  const hargaStandar = Number(formData.get('harga_standar') ?? 0);
  const hargaTanahMeter = Number(formData.get('harga_tanah_meter') ?? 0);

  if (!idKavling || !blok || !noKavling || !idTipe) errorRedirect('Data wajib belum lengkap');
  if (![luasTanahStandar, luasTanahReal, hargaStandar, hargaTanahMeter].every(Number.isFinite)) errorRedirect('Data luas tanah atau harga tidak valid');
  if (luasTanahStandar < 0 || luasTanahReal < luasTanahStandar) errorRedirect('Luas tanah real harus lebih besar atau sama dengan luas tanah standar');
  if (hargaStandar < 0 || hargaTanahMeter < 0) errorRedirect('Harga tidak boleh negatif');

  const [{ data: kavling, error: kavlingError }, { data: tipe, error: tipeError }, { data: activeSales, error: salesError }, { data: activeSpk, error: spkError }, { data: anySales, error: anySalesError }, { data: anySpk, error: anySpkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,id_tipe,status_aktif').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('master_tipe_rumah').select('id_tipe,status_aktif').eq('id_tipe', idTipe).maybeSingle(),
    supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).eq('status_aktif', true).limit(1),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).limit(1),
    supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).limit(1),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).limit(1),
  ]);

  if (kavlingError || tipeError || salesError || spkError || anySalesError || anySpkError) {
    errorRedirect((kavlingError ?? tipeError ?? salesError ?? spkError ?? anySalesError ?? anySpkError)?.message ?? 'Gagal membaca relasi kavling');
  }
  if (!kavling) errorRedirect('Kavling tidak ditemukan');
  if (!kavling.status_aktif) errorRedirect('Kavling nonaktif tidak dapat diedit');
  if (!tipe || !tipe.status_aktif) errorRedirect('Tipe rumah tidak ditemukan atau nonaktif');
  if (kavling.id_tipe !== idTipe && ((anySales ?? []).length > 0 || (anySpk ?? []).length > 0)) {
    errorRedirect('Tipe rumah tidak dapat diubah karena kavling sudah memiliki histori Sales atau SPK');
  }
  if ((activeSales ?? []).length > 0 && formData.get('luas_tanah_standar') == null) {
    errorRedirect('Data kavling tidak lengkap');
  }
  if ((activeSpk ?? []).length > 0 && formData.get('id_tipe') == null) {
    errorRedirect('Data kavling tidak lengkap');
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

  if (error) errorRedirect(error.message);

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

  const idKavling = text(formData.get('id_kavling'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKavling) errorRedirect('ID kavling tidak valid');

  if (statusAktif) {
    const [{ data: activeSpk, error: spkError }, { data: activeSales, error: salesError }] = await Promise.all([
      supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
      supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).eq('status_aktif', true).maybeSingle(),
    ]);

    if (spkError || salesError) errorRedirect((spkError ?? salesError)?.message ?? 'Gagal membaca relasi kavling');
    if (activeSpk) errorRedirect('Kavling tidak boleh dinonaktifkan karena masih memiliki SPK aktif');
    if (activeSales) errorRedirect('Kavling tidak boleh dinonaktifkan karena masih memiliki sales aktif');
  }

  const { error } = await supabase
    .from('master_kavling')
    .update({ status_aktif: !statusAktif })
    .eq('id_kavling', idKavling);

  if (error) errorRedirect(error.message);

  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  redirect('/master/kavling?success=Status%20kavling%20berhasil%20diperbarui');
}
