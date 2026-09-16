"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

const VALID_STATUS = ['BOOKING', 'DP', 'PROSES_KPR', 'AKAD', 'BATAL'] as const;
const VALID_PAYMENT = ['KPR', 'CASH', 'CASH_BERTAHAP'] as const;
const SALEABLE_KAVLING_STATUS = ['AVAILABLE', 'BUILDING', 'READY_STOCK'] as const;
function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }
function money(value: FormDataEntryValue | null) { const raw = text(value); if (raw === '') return null; const n = Number(raw); return Number.isFinite(n) && n >= 0 ? n : NaN; }
function redirectError(message: string) { redirect(`/master/sales?error=${encodeURIComponent(message)}&add=1`); }

export async function createSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const idKavling = text(formData.get('id_kavling'));
  const namaKonsumen = text(formData.get('nama_konsumen'));
  const statusSales = text(formData.get('status_sales')) || 'BOOKING';
  const jenisPembayaran = text(formData.get('jenis_pembayaran')) || 'KPR';
  const idBank = text(formData.get('id_bank')) || null;
  const idNotaris = text(formData.get('id_notaris')) || null;
  const hargaJual = money(formData.get('harga_jual'));
  const tglBooking = text(formData.get('tgl_booking')) || null;
  const targetAkad = text(formData.get('target_akad')) || null;
  const tglAkad = text(formData.get('tgl_akad')) || null;
  if (!idKavling || !namaKonsumen) redirectError('Kavling dan nama konsumen wajib diisi');
  if (!(VALID_STATUS as readonly string[]).includes(statusSales)) redirectError('Status sales tidak valid');
  if (!(VALID_PAYMENT as readonly string[]).includes(jenisPembayaran)) redirectError('Jenis pembayaran tidak valid');
  if (typeof hargaJual === 'number' && !Number.isFinite(hargaJual)) redirectError('Harga jual tidak valid');
  if (tglBooking && targetAkad && targetAkad < tglBooking) redirectError('Target akad tidak boleh sebelum tanggal booking');
  if (jenisPembayaran === 'KPR' && !idBank) redirectError('Bank wajib dipilih untuk pembayaran KPR');
  if (statusSales === 'AKAD' && (!tglAkad || !idNotaris)) redirectError('Tanggal akad dan notaris wajib diisi untuk status AKAD');

  const [{ data: kavling, error: kavlingError }, { data: activeSales, error: salesError }, { data: activeSpk, error: spkError }] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling,status_kavling,status_aktif').eq('id_kavling', idKavling).maybeSingle(),
    supabase.from('sales').select('id_sales').eq('id_kavling', idKavling).eq('status_aktif', true).maybeSingle(),
    supabase.from('spk').select('id_spk').eq('id_kavling', idKavling).eq('is_active', true).maybeSingle(),
  ]);
  if (kavlingError || salesError || spkError) redirectError((kavlingError ?? salesError ?? spkError)?.message ?? 'Gagal membaca relasi kavling');
  if (!kavling || !kavling.status_aktif) return redirectError('Kavling tidak ditemukan atau nonaktif');
  if (activeSales) return redirectError('Kavling tersebut sudah memiliki sales aktif');
  if (!(SALEABLE_KAVLING_STATUS as readonly string[]).includes(kavling.status_kavling)) return redirectError(`Kavling berstatus ${kavling.status_kavling} tidak dapat dibuatkan sales baru`);
  if (statusSales === 'AKAD' && !targetAkad) redirectError('Target akad wajib diisi untuk status AKAD');

  const { data: inserted, error: insertError } = await supabase.from('sales').insert({ id_kavling:idKavling, nama_konsumen:namaKonsumen, status_sales:statusSales, jenis_pembayaran:jenisPembayaran, id_bank:idBank, id_notaris:idNotaris, harga_jual:hargaJual, tgl_booking:tglBooking, target_akad:targetAkad, tgl_akad:tglAkad, status_aktif:statusSales !== 'BATAL' }).select('id_sales').single();
  if (insertError || !inserted) return redirectError(insertError?.message ?? 'Sales gagal disimpan');

  const nextKavlingStatus = activeSpk ? 'BUILDING' : statusSales === 'BATAL' ? (kavling.status_kavling === 'READY_STOCK' ? 'READY_STOCK' : 'AVAILABLE') : statusSales === 'AKAD' ? 'SOLD' : 'BOOKING';
  const { error: kavlingUpdateError } = await supabase.from('master_kavling').update({ status_kavling: nextKavlingStatus }).eq('id_kavling', idKavling);
  if (kavlingUpdateError) { await supabase.from('sales').delete().eq('id_sales', inserted.id_sales); return redirectError(kavlingUpdateError.message); }
  revalidatePath('/master/sales'); revalidatePath('/master/kavling'); revalidatePath('/master/spk'); revalidatePath('/dashboard');
  redirect('/master/sales?success=Sales%20berhasil%20disimpan');
}

export async function updateSalesInfo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const idSales = text(formData.get('id_sales'));
  const jenisPembayaran = text(formData.get('jenis_pembayaran'));
  const idBank = text(formData.get('id_bank')) || null;
  const idNotaris = text(formData.get('id_notaris')) || null;
  const tglAkad = text(formData.get('tgl_akad')) || null;
  const targetAkad = text(formData.get('target_akad')) || null;
  const statusSales = text(formData.get('status_sales'));
  if (!idSales) return redirect(`/master/sales?error=ID%20sales%20tidak%20valid`);
  if (jenisPembayaran === 'KPR' && !idBank) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=Bank%20wajib%20dipilih%20untuk%20KPR`);
  if (statusSales === 'AKAD' && (!tglAkad || !idNotaris)) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=Tanggal%20akad%20dan%20notaris%20wajib%20diisi`);
  const { error } = await supabase.from('sales').update({ jenis_pembayaran:jenisPembayaran, id_bank:idBank, id_notaris:idNotaris, tgl_akad:tglAkad, target_akad:targetAkad, status_sales:statusSales }).eq('id_sales', idSales);
  if (error) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=${encodeURIComponent(error.message)}`);
  revalidatePath('/master/sales'); revalidatePath(`/master/sales/detail`); revalidatePath('/dashboard');
  redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&success=Data%20Sales%20diperbarui`);
}

export async function deactivateSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const idSales = text(formData.get('id_sales')); if (!idSales) return redirectError('ID sales tidak valid');
  const { data: sales, error } = await supabase.from('sales').select('id_sales,id_kavling,status_sales,status_aktif').eq('id_sales', idSales).maybeSingle();
  if (error || !sales) return redirectError(error?.message ?? 'Data sales tidak ditemukan');
  const { error: updateError } = await supabase.from('sales').update({ status_aktif:false, status_sales:sales.status_sales === 'AKAD' ? 'AKAD' : 'BATAL' }).eq('id_sales',idSales).eq('status_aktif',true);
  if (updateError) return redirectError(updateError.message);
  const [{ data: activeSpk, error:spkError },{data:kavling,error:kavlingError},{data:completedSpk,error:completedError}] = await Promise.all([supabase.from('spk').select('id_spk').eq('id_kavling',sales.id_kavling).eq('is_active',true).maybeSingle(),supabase.from('master_kavling').select('status_kavling').eq('id_kavling',sales.id_kavling).maybeSingle(),supabase.from('spk').select('id_spk').eq('id_kavling',sales.id_kavling).eq('status_spk','SELESAI').limit(1).maybeSingle()]);
  if (spkError || kavlingError || completedError) return redirectError((spkError??kavlingError??completedError)?.message ?? 'Gagal membaca status kavling');
  if (!kavling) return redirectError('Kavling sales tidak ditemukan');
  if (!activeSpk) { const nextStatus = sales.status_sales === 'AKAD' ? 'SOLD' : completedSpk ? 'READY_STOCK' : 'AVAILABLE'; const {error:kErr}=await supabase.from('master_kavling').update({status_kavling:nextStatus}).eq('id_kavling',sales.id_kavling); if(kErr)return redirectError(kErr.message); }
  revalidatePath('/master/sales'); revalidatePath('/master/kavling'); revalidatePath('/master/spk'); revalidatePath('/dashboard');
  redirect('/master/sales?success=Sales%20berhasil%20ditutup');
}
