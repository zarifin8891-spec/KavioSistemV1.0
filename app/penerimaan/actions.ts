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
    redirectKavioFormError('/penerimaan','Sales, jenis, tanggal, nominal, dan metode penerimaan wajib valid.',{focus:text(form,'focus')||'receipt_cash',params:{tab:'piutang',...(text(form,'id_penerimaan')?{edit:text(form,'id_penerimaan')}:{})}});
  }
  const focus=text(form,'focus')||'receipt_cash';
  const idReceipt=text(form,'id_penerimaan');
  const mode=text(form,'jaminan_mode');
  const kinds=jenis==='PENCAIRAN_KPR'?(mode==='GLOBAL'?['GLOBAL']:mode==='RINCI'?['IMB','SERTIFIKAT','AIR_LISTRIK','BESTEK']:[]):[];
  if(kinds.some(k=>!Number.isFinite(Number(text(form,`nominal_${k}`)))||Number(text(form,`nominal_${k}`))<0))redirectKavioFormError('/penerimaan','Nominal dana jaminan wajib valid dan tidak negatif.',{focus,params:{tab:'piutang',...(idReceipt?{edit:idReceipt}:{})}});
  const jaminan=kinds.filter(k=>Number(text(form,`nominal_${k}`))>0).map(k=>({jenis_item:k,nominal_tagihan:Number(text(form,`nominal_${k}`))}));
  const payload={id_sales:idSales,jenis_penerimaan:jenis,tanggal_penerimaan:tanggal,nominal,metode_penerimaan:metode,id_bank_penerimaan:text(form,'id_bank_penerimaan'),id_jaminan:text(form,'id_jaminan')||null,no_referensi:text(form,'no_referensi')||null,keterangan:text(form,'keterangan')||null,jaminan};
  const {data,error}=idReceipt
    ?await supabase.rpc('amend_sales_receipt_atomic',{p_id_penerimaan:idReceipt,p_alasan:text(form,'alasan'),p_pengganti:payload})
    :await supabase.rpc('post_sales_receipt_v2_atomic',{p_data:payload});
  if(error)redirectKavioFormError('/penerimaan',error.message,{focus,params:{tab:focus.startsWith('guarantee_receipt:')?'jaminan':'piutang',...(idReceipt?{edit:idReceipt}:{})}});

  revalidatePath('/penerimaan');
  revalidatePath('/master/sales');
  revalidatePath('/dashboard');
  const receipt=idReceipt?{id_penerimaan:data}:Array.isArray(data)?data[0]:data;
  if (receipt?.id_penerimaan) redirect(`/penerimaan/kuitansi?id=${encodeURIComponent(receipt.id_penerimaan)}`);
  redirect('/penerimaan?tab=piutang&success=penerimaan+tersimpan');
}

export async function submitBankGuaranteeClaim(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_RECEIPT_WRITE','/penerimaan?error=akses+ditolak');
  const id=text(form,'id_jaminan');
  const date=text(form,'tanggal_pengajuan');
  if(!id||!date) redirectKavioFormError('/penerimaan','Item jaminan dan tanggal pengajuan wajib diisi.',{focus:'claim_date',params:{tab:'jaminan'}});
  const {error}=await supabase.rpc('submit_sales_bank_guarantee_claim_atomic',{p_id_jaminan:id,p_tanggal_pengajuan:date,p_keterangan:text(form,'keterangan_pengajuan')||null});
  if(error) redirectKavioFormError('/penerimaan',error.message,{focus:'claim_date',params:{tab:'jaminan'}});
  revalidatePath('/penerimaan');
  redirect('/penerimaan?tab=jaminan&success=pengajuan+dana+jaminan+dicatat');
}

export async function saveSalesCancellationSettlement(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('PAYMENT_RECEIPT_WRITE','/penerimaan?error=akses+ditolak');
  const idSales=text(form,'id_sales');
  const decision=text(form,'keputusan');
  const refund=Number(text(form,'nominal_dikembalikan'));
  const retained=Number(text(form,'nominal_ditahan'));
  const reason=text(form,'alasan');
  const refundStatus=text(form,'status_pengembalian');
  const refundDate=text(form,'tanggal_pengembalian');
  if(!idSales||!decision||!Number.isFinite(refund)||refund<0||!Number.isFinite(retained)||retained<0||!reason){
    redirectKavioFormError('/penerimaan','Keputusan pembatalan, nilai pengembalian, nilai ditahan, dan alasan wajib diisi.',{focus:'settlement_reason',params:{tab:'pembatalan'}});
  }
  if(refund>0&&refundStatus==='SUDAH_DIBAYAR'&&!refundDate) redirectKavioFormError('/penerimaan','Tanggal pengembalian wajib diisi bila sudah dibayar.',{focus:'settlement_reason',params:{tab:'pembatalan'}});
  const {error}=await supabase.rpc('save_sales_cancellation_settlement_atomic',{
    p_id_sales:idSales,p_keputusan:decision,p_nominal_dikembalikan:refund,p_nominal_ditahan:retained,
    p_alasan:reason,p_status_pengembalian:refundStatus,p_tanggal_pengembalian:refundStatus==='SUDAH_DIBAYAR'?refundDate:null,
  });
  if(error) redirectKavioFormError('/penerimaan',error.message,{focus:'settlement_reason',params:{tab:'pembatalan'}});
  revalidatePath('/penerimaan');
  redirect('/penerimaan?tab=pembatalan&success=penyelesaian+pembatalan+tersimpan');
}

export async function voidSalesReceipt(form:FormData){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 await requireKavioAction('PAYMENT_RECEIPT_WRITE','/penerimaan?error=akses+ditolak');
 const {error}=await supabase.rpc('amend_sales_receipt_atomic',{p_id_penerimaan:text(form,'id_penerimaan'),p_alasan:text(form,'alasan'),p_pengganti:null});
 if(error)redirectKavioFormError('/penerimaan',error.message,{focus:'receipt_void',params:{tab:'piutang',hapus:text(form,'id_penerimaan')}});
 revalidatePath('/penerimaan');revalidatePath('/dashboard');revalidatePath('/master/sales');redirect('/penerimaan?tab=piutang&success=Penerimaan+dihapus.+Riwayat+kuitansi+ditandai+batal');
}
