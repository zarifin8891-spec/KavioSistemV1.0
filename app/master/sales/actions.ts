"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

const VALID_STATUS = ['BOOKING', 'PROSES_KPR', 'AKAD', 'BATAL'] as const;
const VALID_PAYMENT = ['KPR', 'CASH', 'CASH_BERTAHAP'] as const;
const SALEABLE_KAVLING_STATUS = ['AVAILABLE', 'BUILDING', 'READY_STOCK'] as const;

function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }
function money(value: FormDataEntryValue | null) { const n = Number(text(value)); return text(value) === '' ? null : Number.isFinite(n) && n >= 0 ? n : NaN; }
function redirectError(message: string) { redirect(`/master/sales?error=${encodeURIComponent(message)}`); }

export async function createSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const idKavling = text(formData.get('id_kavling'));
  const namaKonsumen = text(formData.get('nama_konsumen'));
  const statusSales = text(formData.get('status_sales')) || 'BOOKING';
  const jenisPembayaran = text(formData.get('jenis_pembayaran')) || 'KPR';
  const hargaJual = money(formData.get('harga_jual'));
  const tglBooking = text(formData.get('tgl_booking')) || null;
  const targetAkad = text(formData.get('target_akad')) || null;

  if (!idKavling || !namaKonsumen) redirectError('Kavling dan nama konsumen wajib diisi');
  if (!(VALID_STATUS as readonly string[]).includes(statusSales)) redirectError('Status sales tidak valid');
  if (!(VALID_PAYMENT as readonly string[]).includes(jenisPembayaran)) redirectError('Jenis pembayaran tidak valid');
  if (typeof hargaJual === 'number' && !Number.isFinite(hargaJual)) redirectError('Harga jual tidak valid');
  if (tglBooking && targetAkad && targetAkad < tglBooking) redirectError('Target akad tidak boleh sebelum tanggal booking');

  const [{ data: kavling, error: kavlingError }, { data: activeSales, error: salesError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, status_kavling, status_aktif').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
  ]);

  if (kavlingError || salesError) redirectError((kavlingError ?? salesError)?.message ?? 'Gagal membaca relasi kavling');
  if (!kavling || !kavling.status_aktif) redirectError('Kavling tidak ditemukan atau nonaktif');
  if (activeSales) redirectError('Kavling tersebut sudah memiliki sales aktif');
  if (!(SALEABLE_KAVLING_STATUS as readonly string[]).includes(kavling.status_kavling)) {
    redirectError(`Kavling berstatus ${kavling.status_kavling} tidak dapat dibuatkan sales baru`);
  }
  if (statusSales === 'AKAD' && !targetAkad) redirectError('Target akad wajib diisi untuk status AKAD');

  const insertSales = await supabase.from('sales').insert({
    id_kavling: idKavling,
    nama_konsumen: namaKonsumen,
    status_sales: statusSales,
    jenis_pembayaran: jenisPembayaran,
    harga_jual: hargaJual,
    tgl_booking: tglBooking,
    target_akad: targetAkad,
    status_aktif: statusSales !== 'BATAL',
  }).select('id_sales').single();

  if (insertSales.error || !insertSales.data) redirectError(insertSales.error?.message ?? 'Sales gagal disimpan');

  const nextKavlingStatus = statusSales === 'BATAL'
    ? kavling.status_kavling === 'BUILDING' ? 'BUILDING' : kavling.status_kavling === 'READY_STOCK' ? 'READY_STOCK' : 'AVAILABLE'
    : statusSales === 'AKAD'
      ? 'SOLD'
      : 'BOOKING';

  const { error: kavlingUpdateError } = await supabase.from('master_kavling').update({ status_kavling: nextKavlingStatus }).eq('id_kavling', idKavling);
  if (kavlingUpdateError) {
    await supabase.from('sales').delete().eq('id_sales', insertSales.data.id_sales);
    redirectError(kavlingUpdateError.message);
  }

  revalidatePath('/master/sales');
  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect('/master/sales?success=Sales%20berhasil%20disimpan');
}

export async function deactivateSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const idSales = text(formData.get('id_sales'));
  if (!idSales) redirectError('ID sales tidak valid');

  const { data: sales, error } = await supabase.from('sales').select('id_sales, id_kavling, status_sales, status_aktif').eq('id_sales', idSales).maybeSingle();
  if (error || !sales) redirectError(error?.message ?? 'Data sales tidak ditemukan');

  const { error: updateError } = await supabase.from('sales').update({ status_aktif: false, status_sales: sales.status_sales === 'AKAD' ? 'AKAD' : 'BATAL' }).eq('id_sales', idSales).eq('status_aktif', true);
  if (updateError) redirectError(updateError.message);

  const [{ data: activeSpk, error: spkError }, { data: kavling, error: kavlingReadError }, { data: completedSpk, error: completedSpkError }] = await Promise.all([
    supabase.from('spk').select('id_spk').eq('id_kavling', sales.id_kavling).eq('is_active', true).maybeSingle(),
    supabase.from('master_kavling').select('status_kavling').eq('id_kavling', sales.id_kavling).maybeSingle(),
    supabase.from('spk').select('id_spk').eq('id_kavling', sales.id_kavling).eq('status_spk', 'SELESAI').limit(1).maybeSingle(),
  ]);
  if (spkError || kavlingReadError || completedSpkError) redirectError((spkError ?? kavlingReadError ?? completedSpkError)?.message ?? 'Gagal membaca status kavling');

  if (!activeSpk) {
    const nextStatus = sales.status_sales === 'AKAD' ? 'SOLD' : completedSpk ? 'READY_STOCK' : 'AVAILABLE';
    const { error: kavlingError } = await supabase.from('master_kavling').update({ status_kavling: nextStatus }).eq('id_kavling', sales.id_kavling);
    if (kavlingError) redirectError(kavlingError.message);
  }

  revalidatePath('/master/sales');
  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect('/master/sales?success=Sales%20berhasil%20ditutup');
}
