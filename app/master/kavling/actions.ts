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
