'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireKavioAction } from '../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../lib/kavio-form-feedback';

function text(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }

export async function postSalesReceipt(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_RECEIPT_WRITE', '/penerimaan?error=akses+ditolak');
  const idSales=text(form,'id_sales');
  const jenis=text(form,'jenis_penerimaan');
  const tanggal=text(form,'tanggal_penerimaan');
  const nominal=Number(text(form,'nominal'));
  const metode=text(form,'metode_penerimaan');
  if (!idSales || !jenis || !tanggal || !Number.isFinite(nominal) || nominal<=0 || !metode) {
    redirectKavioFormError('/penerimaan','Sales, jenis, tanggal, nominal, dan metode penerimaan wajib valid.',{focus:'receipt_sales'});
  }
  const { data, error } = await supabase.rpc('post_sales_receipt_atomic', {
    p_id_sales:idSales,
    p_jenis_penerimaan:jenis,
    p_tanggal_penerimaan:tanggal,
    p_nominal:nominal,
    p_metode_penerimaan:metode,
    p_id_jaminan:text(form,'id_jaminan') || null,
    p_no_referensi:text(form,'no_referensi') || null,
    p_keterangan:text(form,'keterangan') || null,
  });
  if (error) redirectKavioFormError('/penerimaan',error.message,{focus:'receipt_sales'});
  revalidatePath('/penerimaan');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  const receipt=Array.isArray(data)?data[0]:data;
  if (receipt?.id_penerimaan) redirect(`/penerimaan/kuitansi?id=${encodeURIComponent(receipt.id_penerimaan)}`);
  redirect('/penerimaan?success=penerimaan+tersimpan');
}

export async function saveCashInstallmentTerms(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_PLAN_WRITE','/penerimaan?error=akses+ditolak');
  const idSales=text(form,'id_sales');
  const tenor=Number(text(form,'tenor_bulan'));
  const pola=text(form,'pola_pelunasan');
  if (!idSales || !Number.isInteger(tenor) || tenor<6 || tenor>12 || !['CICILAN_FLEKSIBEL','LUNAS_DI_AKHIR'].includes(pola)) {
    redirectKavioFormError('/penerimaan','Pilih transaksi Cash Bertahap, tenor 6–12 bulan, dan pola pelunasan.',{focus:'terms_sales'});
  }
  const { error }=await supabase.rpc('save_sales_cash_installment_terms_atomic',{p_id_sales:idSales,p_tenor_bulan:tenor,p_pola_pelunasan:pola});
  if (error) redirectKavioFormError('/penerimaan',error.message,{focus:'terms_sales'});
  revalidatePath('/penerimaan');
  redirect('/penerimaan?success=ketentuan+cash+bertahap+tersimpan');
}

export async function saveBankGuaranteeItems(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_RECEIPT_WRITE','/penerimaan?error=akses+ditolak');
  const idSales=text(form,'id_sales');
  const kind=text(form,'jenis_item');
  const selected=kind==='GLOBAL' ? ['GLOBAL'] : ['IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK'].filter((item)=>Number(text(form,`nominal_${item}`))>0);
  const items=selected.map((item)=>({jenis_item:item,nominal_tagihan:item==='GLOBAL'?Number(text(form,'nominal_GLOBAL')):Number(text(form,`nominal_${item}`)),keterangan:text(form,`keterangan_${item}`)||null}));
  if (!idSales||!items.length||items.some((item)=>!Number.isFinite(item.nominal_tagihan)||item.nominal_tagihan<=0)) redirectKavioFormError('/penerimaan','Pilih Sales KPR setelah akad dan isi minimal satu nilai jaminan.',{focus:'guarantee_sales'});
  const {error}=await supabase.rpc('upsert_sales_bank_guarantee_atomic',{p_id_sales:idSales,p_items:items});
  if(error) redirectKavioFormError('/penerimaan',error.message,{focus:'guarantee_sales'});
  revalidatePath('/penerimaan');
  redirect('/penerimaan?success=dana+jaminan+tersimpan');
}

export async function submitBankGuaranteeClaim(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_RECEIPT_WRITE','/penerimaan?error=akses+ditolak');
  const id=text(form,'id_jaminan');
  const date=text(form,'tanggal_pengajuan');
  if(!id||!date) redirectKavioFormError('/penerimaan','Item jaminan dan tanggal pengajuan wajib diisi.');
  const {error}=await supabase.rpc('submit_sales_bank_guarantee_claim_atomic',{p_id_jaminan:id,p_tanggal_pengajuan:date,p_keterangan:text(form,'keterangan_pengajuan')||null});
  if(error) redirectKavioFormError('/penerimaan',error.message);
  revalidatePath('/penerimaan');
  redirect('/penerimaan?success=pengajuan+dana+jaminan+dicatat');
}
