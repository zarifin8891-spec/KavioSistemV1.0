"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

const VALID_STATUS = ['BOOKING', 'DP', 'PROSES_KPR', 'AKAD', 'BATAL'] as const;
const VALID_PAYMENT = ['KPR', 'CASH', 'CASH_BERTAHAP'] as const;
const SALEABLE_KAVLING_STATUS = ['AVAILABLE', 'BUILDING', 'READY_STOCK'] as const;
function text(value: FormDataEntryValue | null) { return String(value ?? '').trim(); }

function createError(message: string, focus = 'id_kavling'): never {
  redirectKavioFormError('/master/sales', message, { form: 'sales-create', focus });
}

function detailError(idSales: string, message: string, form: 'sales-edit' | 'sales-cost', focus: string): never {
  redirectKavioFormError('/master/sales/detail', message, { form, focus, params: { id: idSales } });
}

function pageError(message: string): never {
  redirectKavioFormError('/master/sales', message);
}

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

  if (error) {
    const lower = error.message.toLowerCase();
    createError(error.message, lower.includes('konsumen') ? 'nama_konsumen' : lower.includes('bank') ? 'id_bank' : 'id_kavling');
  }

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

  if (!idSales) pageError('ID SALES TIDAK VALID');
  if (!namaKonsumen) detailError(idSales, 'NAMA KONSUMEN WAJIB DIISI', 'sales-edit', 'nama_konsumen');
  if (!(VALID_STATUS as readonly string[]).includes(statusSales)) detailError(idSales, 'STATUS SALES TIDAK VALID', 'sales-edit', 'status_sales');
  if (!(VALID_PAYMENT as readonly string[]).includes(jenisPembayaran)) detailError(idSales, 'JENIS PEMBAYARAN TIDAK VALID', 'sales-edit', 'jenis_pembayaran');

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

  if (error) {
    const lower = error.message.toLowerCase();
    detailError(
      idSales,
      error.message,
      'sales-edit',
      lower.includes('bank') ? 'id_bank'
        : lower.includes('notaris') ? 'id_notaris'
          : lower.includes('akad') ? 'tgl_akad'
            : 'nama_konsumen',
    );
  }

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
  if (!idSales) pageError('ID SALES TIDAK VALID');

  const biayaPenambahanBangunan = Number(formData.get('biaya_penambahan_bangunan') ?? 0);
  const biayaKelebihanTanah = Number(formData.get('biaya_kelebihan_tanah') ?? 0);
  const biayaNotaris = Number(formData.get('biaya_notaris') ?? 0);
  const biayaAkad = Number(formData.get('biaya_akad') ?? 0);
  const biayaHook = Number(formData.get('biaya_hook') ?? 0);
  const biayaLainnya = Number(formData.get('biaya_lainnya') ?? 0);

  const { error } = await supabase.rpc('save_sales_biaya_atomic', {
    p_id_sales: idSales,
    p_biaya_penambahan_bangunan: biayaPenambahanBangunan,
    p_biaya_kelebihan_tanah: biayaKelebihanTanah,
    p_biaya_notaris: biayaNotaris,
    p_biaya_akad: biayaAkad,
    p_biaya_hook: biayaHook,
    p_biaya_lainnya: biayaLainnya,
  });

  if (error) detailError(idSales, error.message, 'sales-cost', 'biaya_penambahan_bangunan');

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

  const idSales = text(formData.get('id_sales'));
  if (!idSales) pageError('ID SALES TIDAK VALID');

  const { error } = await supabase.rpc('close_sales_atomic', { p_id_sales: idSales });
  if (error) pageError(error.message);

  revalidatePath('/master/sales');
  revalidatePath('/master/sales/detail');
  revalidatePath('/master/kavling');
  revalidatePath('/master/spk');
  revalidatePath('/siteplan');
  revalidatePath('/dashboard');
  redirect('/master/sales?success=SALES%20BERHASIL%20DITUTUP');
}
