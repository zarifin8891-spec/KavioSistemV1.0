"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';

const VALID_STATUS = ['BOOKING', 'DP', 'PROSES_KPR', 'AKAD', 'BATAL'] as const;
const VALID_PAYMENT = ['KPR', 'CASH', 'CASH_BERTAHAP'] as const;
const SALEABLE_KAVLING_STATUS = ['AVAILABLE', 'BUILDING', 'READY_STOCK'] as const;
function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }
function redirectError(message: string) { redirect(`/master/sales?error=${encodeURIComponent(message)}&add=1`); }
function detailError(idSales: string, message: string) { redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=${encodeURIComponent(message)}`); }

export async function createSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SALES_WRITE', '/master/sales?error=');

  const idKavling = text(formData.get('id_kavling'));
  const namaKonsumen = text(formData.get('nama_konsumen'));
  const alamatKonsumen = text(formData.get('alamat_konsumen')) || null;
  const hpKonsumen = text(formData.get('hp_konsumen')) || null;
  const statusSales = text(formData.get('status_sales')) || 'BOOKING';
  const jenisPembayaran = text(formData.get('jenis_pembayaran')) || 'KPR';
  const idBank = text(formData.get('id_bank')) || null;
  const idNotaris = text(formData.get('id_notaris')) || null;
  const tglBooking = text(formData.get('tgl_booking')) || null;
  const targetAkad = text(formData.get('target_akad')) || null;
  const tglAkad = text(formData.get('tgl_akad')) || null;
  const biayaPenambahanBangunan = Number(formData.get('biaya_penambahan_bangunan') ?? 0);
  const biayaNotaris = Number(formData.get('biaya_notaris') ?? 0);
  const biayaHook = Number(formData.get('biaya_hook') ?? 0);
  const biayaLainnya = Number(formData.get('biaya_lainnya') ?? 0);

  const { error } = await supabase.rpc('create_sales_atomic', {
    p_id_kavling: idKavling,
    p_nama_konsumen: namaKonsumen,
    p_alamat_konsumen: alamatKonsumen,
    p_hp_konsumen: hpKonsumen,
    p_status_sales: statusSales,
    p_jenis_pembayaran: jenisPembayaran,
    p_id_bank: idBank,
    p_id_notaris: idNotaris,
    p_tgl_booking: tglBooking,
    p_target_akad: targetAkad,
    p_tgl_akad: tglAkad,
    p_biaya_penambahan_bangunan: biayaPenambahanBangunan,
    p_biaya_notaris: biayaNotaris,
    p_biaya_hook: biayaHook,
    p_biaya_lainnya: biayaLainnya,
  });

  if (error) return redirectError(error.message);

  revalidatePath('/master/sales');
  revalidatePath('/master/sales/detail');
  revalidatePath('/master/kavling');
  revalidatePath('/siteplan');
  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect(`/master/sales?success=${encodeURIComponent('SALES BERHASIL DISIMPAN')}`);
}

export async function updateSalesInfo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SALES_WRITE', '/master/sales?error=');

  const idSales = text(formData.get('id_sales'));
  const namaKonsumen = text(formData.get('nama_konsumen'));
  const statusSales = text(formData.get('status_sales'));
  const jenisPembayaran = text(formData.get('jenis_pembayaran'));
  const alamatKonsumen = text(formData.get('alamat_konsumen')) || null;
  const hpKonsumen = text(formData.get('hp_konsumen')) || null;
  const idBank = text(formData.get('id_bank')) || null;
  const idNotaris = text(formData.get('id_notaris')) || null;
  const tglAkad = text(formData.get('tgl_akad')) || null;
  const targetAkad = text(formData.get('target_akad')) || null;

  if (!idSales) return redirect('/master/sales?error=ID%20SALES%20TIDAK%20VALID');
  if (!namaKonsumen) return detailError(idSales, 'NAMA KONSUMEN WAJIB DIISI');
  if (!(VALID_STATUS as readonly string[]).includes(statusSales)) return detailError(idSales, 'STATUS SALES TIDAK VALID');
  if (!(VALID_PAYMENT as readonly string[]).includes(jenisPembayaran)) return detailError(idSales, 'JENIS PEMBAYARAN TIDAK VALID');

  const { error } = await supabase.rpc('update_sales_atomic', {
    p_id_sales: idSales,
    p_nama_konsumen: namaKonsumen,
    p_alamat_konsumen: alamatKonsumen,
    p_hp_konsumen: hpKonsumen,
    p_status_sales: statusSales,
    p_jenis_pembayaran: jenisPembayaran,
    p_id_bank: idBank,
    p_id_notaris: idNotaris,
    p_tgl_akad: tglAkad || null,
    p_target_akad: targetAkad || null,
  });

  if (error) return detailError(idSales, error.message);

  revalidatePath('/master/sales');
  revalidatePath('/master/sales/detail');
  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/dashboard');
  redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&success=DATA%20SALES%20DIPERBARUI`);
}

export async function saveSalesBiaya(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SALES_WRITE', '/master/sales?error=');

  const idSales = text(formData.get('id_sales'));
  if (!idSales) return detailError('', 'ID SALES TIDAK VALID');

  const items = [
    ['PENAMBAHAN BANGUNAN', Number(formData.get('biaya_penambahan_bangunan') ?? 0)],
    ['NOTARIS', Number(formData.get('biaya_notaris') ?? 0)],
    ['PEMILIHAN LOKASI HOOK', Number(formData.get('biaya_hook') ?? 0)],
    ['BIAYA LAINNYA', Number(formData.get('biaya_lainnya') ?? 0)],
  ] as const;

  if (!items.every(([, nominal]) => Number.isFinite(nominal) && nominal >= 0)) {
    return detailError(idSales, 'BIAYA TAMBAHAN TIDAK VALID');
  }

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id_sales')
    .eq('id_sales', idSales)
    .maybeSingle();

  if (saleError || !sale) return detailError(idSales, saleError?.message ?? 'DATA SALES TIDAK DITEMUKAN');

  const { error: upsertError } = await supabase
    .from('sales_biaya_tambahan')
    .upsert(
      items
        .filter(([, nominal]) => nominal > 0)
        .map(([jenis_biaya, nominal]) => ({ id_sales: idSales, jenis_biaya, nominal, status_aktif: true })),
      { onConflict: 'id_sales,jenis_biaya' },
    );

  if (upsertError) return detailError(idSales, upsertError.message);

  const zeroTypes = items.filter(([, nominal]) => nominal === 0).map(([jenis_biaya]) => jenis_biaya);
  if (zeroTypes.length) {
    const { error: deleteError } = await supabase
      .from('sales_biaya_tambahan')
      .delete()
      .eq('id_sales', idSales)
      .in('jenis_biaya', zeroTypes);
    if (deleteError) return detailError(idSales, deleteError.message);
  }

  revalidatePath('/master/sales');
  revalidatePath('/master/sales/detail');
  revalidatePath('/master/kavling');
  revalidatePath('/dashboard');
  redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&success=BIAYA%20SALES%20BERHASIL%20DIPERBARUI`);
}

export async function deactivateSales(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('SALES_WRITE', '/master/sales?error=');
  const idSales = text(formData.get('id_sales')); if (!idSales) return redirectError('ID SALES TIDAK VALID');
  const { data: sales, error } = await supabase.from('sales').select('id_sales,id_kavling,status_sales,status_aktif').eq('id_sales', idSales).maybeSingle();
  if (error || !sales) return redirectError(error?.message ?? 'DATA SALES TIDAK DITEMUKAN');
  const { error: updateError } = await supabase.from('sales').update({ status_aktif:false, status_sales:sales.status_sales === 'AKAD' ? 'AKAD' : 'BATAL' }).eq('id_sales',idSales).eq('status_aktif',true);
  if (updateError) return redirectError(updateError.message);
  const [{ data: activeSpk, error:spkError },{data:kavling,error:kavlingError},{data:completedSpk,error:completedError}] = await Promise.all([supabase.from('spk').select('id_spk').eq('id_kavling',sales.id_kavling).eq('is_active',true).maybeSingle(),supabase.from('master_kavling').select('status_kavling').eq('id_kavling',sales.id_kavling).maybeSingle(),supabase.from('spk').select('id_spk').eq('id_kavling',sales.id_kavling).eq('status_spk','SELESAI').limit(1).maybeSingle()]);
  if (spkError || kavlingError || completedError) return redirectError((spkError??kavlingError??completedError)?.message ?? 'GAGAL MEMBACA STATUS KAVLING');
  if (!kavling) return redirectError('KAVLING SALES TIDAK DITEMUKAN');
  if (!activeSpk) { const nextStatus = sales.status_sales === 'AKAD' ? 'SOLD' : completedSpk ? 'READY_STOCK' : 'AVAILABLE'; const {error:kErr}=await supabase.from('master_kavling').update({status_kavling:nextStatus}).eq('id_kavling',sales.id_kavling); if(kErr)return redirectError(kErr.message); }
  revalidatePath('/master/sales'); revalidatePath('/master/kavling'); revalidatePath('/master/spk'); revalidatePath('/dashboard');
  redirect('/master/sales?success=SALES%20BERHASIL%20DITUTUP');
}
