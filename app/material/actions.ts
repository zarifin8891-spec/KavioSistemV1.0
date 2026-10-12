'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireKavioAction } from '../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../lib/kavio-form-feedback';
import type { KavioAction } from '../../lib/kavio-permissions';

type MaterialRpc =
  | 'post_material_document_dated_atomic'
  | 'post_material_purchase_v2_atomic'
  | 'amend_material_purchase_atomic'
  | 'fulfill_material_request_v2_atomic'
  | 'post_material_receipt_atomic'
  | 'create_material_request_atomic'
  | 'post_material_issue_to_spk_atomic'
  | 'post_material_direct_usage_atomic'
  | 'post_spk_material_usage_atomic'
  | 'post_supplier_direct_usage_atomic'
  | 'post_spk_material_reconciliation_atomic';

function value(form: FormData, name: string) { return String(form.get(name) ?? '').trim(); }
function materialItems(form:FormData,focus:string,withPrice=false) {
 let items:{id_material:string;jumlah:number;harga_satuan?:number}[]=[];
 try {items=JSON.parse(value(form,'items'));}catch{/* Common validation below. */}
 if(!Array.isArray(items)||!items.length||items.some(i=>!i||!i.id_material||!Number.isFinite(i.jumlah)||i.jumlah<=0||(withPrice&&(!Number.isFinite(i.harga_satuan)||Number(i.harga_satuan)<0)))||new Set(items.map(i=>i.id_material)).size!==items.length)
  redirectKavioFormError('/material','Pilih material tanpa duplikat, jumlah positif, dan harga yang valid.',{focus,params:{tab:transactionTab(focus)}});
 return items.map(i=>({id_material:i.id_material,jumlah:i.jumlah,...(withPrice?{harga_satuan:i.harga_satuan}: {})}));
}

const transactionTab = (focus: string) => focus.startsWith('purchase_') ? 'pembelian' : focus==='receipt_material' ? 'saldo' : 'pemakaian';

async function post(rpc: MaterialRpc, permission: KavioAction, args: Record<string, unknown>, failureFocus: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction(permission, '/material?error=akses+ditolak');
  const { error } = await supabase.rpc(rpc as never, args as never);
  if (error) redirectKavioFormError('/material', error.message, { form: 'material-entry', focus: failureFocus, params: {tab: transactionTab(failureFocus)} });
  revalidatePath('/material');
  revalidatePath('/master/spk');
  revalidatePath('/progress');
  revalidatePath('/dashboard');
  redirect(`/material?tab=${transactionTab(failureFocus)}&success=${encodeURIComponent('TRANSAKSI MATERIAL BERHASIL DISIMPAN')}`);
}

async function postDated(kind:string,permission:KavioAction,args:Record<string,unknown>,focus:string,form:FormData) {
 const tanggal=value(form,'tanggal');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)||!Number.isFinite(Date.parse(tanggal))||new Date(tanggal).toISOString().slice(0,10)!==tanggal||tanggal>today)
  redirectKavioFormError('/material','Tanggal wajib valid dan tidak boleh di masa depan.',{focus,params:{tab:transactionTab(focus)}});
 await post('post_material_document_dated_atomic',permission,{p_kind:kind,p_tanggal:tanggal,p_data:args},focus);
}

export async function postMaterialReceipt(form:FormData) {
 await post('post_material_receipt_atomic','MATERIAL_WAREHOUSE_WRITE',{p_id_lokasi:value(form,'id_lokasi'),p_items:materialItems(form,'receipt_material',true),p_saldo_awal:true,p_keterangan:value(form,'keterangan')||null},'receipt_material');
}
export async function createMaterialRequest(form:FormData) {
 await postDated('REQUEST','MATERIAL_REQUEST_WRITE',{p_id_spk:value(form,'id_spk'),p_sumber_laporan:value(form,'sumber_laporan'),p_items:materialItems(form,'request_spk'),p_keterangan:value(form,'keterangan')||null},'request_spk',form);
}
export async function issueMaterialToSpk(form:FormData) {
 await postDated('ISSUE','MATERIAL_WAREHOUSE_WRITE',{p_id_permintaan:value(form,'id_permintaan'),p_id_lokasi:value(form,'id_lokasi'),p_items:materialItems(form,'issue_request'),p_langsung_pakai:value(form,'langsung_pakai')!=='false',p_keterangan:value(form,'keterangan')||null},'issue_request',form);
}
export async function postDirectMaterialUsage(form:FormData) {
 await postDated('DIRECT','MATERIAL_USE_WRITE',{p_id_spk:value(form,'id_spk'),p_id_lokasi:value(form,'id_lokasi'),p_items:materialItems(form,'direct_spk'),p_keterangan:value(form,'keterangan')||null},'direct_spk',form);
}
export async function postSpkMaterialUsage(form:FormData) {
 await postDated('SPK','MATERIAL_USE_WRITE',{p_id_spk:value(form,'id_spk'),p_items:materialItems(form,'spk_usage_spk'),p_keterangan:value(form,'keterangan')||null},'spk_usage_spk',form);
}
export async function reconcileSpkMaterial(form:FormData) {
 const items=materialItems(form,'reconcile_spk').map(i=>({...i,tindakan:value(form,'tindakan'),id_spk_tujuan:value(form,'id_spk_tujuan')||null,id_lokasi_tujuan:value(form,'id_lokasi_tujuan')||null,alasan:value(form,'alasan')||null}));
 await postDated('RECONCILE','MATERIAL_WAREHOUSE_WRITE',{p_id_spk:value(form,'id_spk'),p_items:items,p_keterangan:value(form,'keterangan')||null},'reconcile_spk',form);
}

function purchaseData(form:FormData) {
 let items: {id_material:string;jumlah:number;harga_satuan:number}[]=[];
 try {items=JSON.parse(value(form,'items'));} catch { /* Validation below produces the form message. */ }
 if(!Array.isArray(items)||!items.length||items.some(i=>!i.id_material||!Number.isFinite(i.jumlah)||i.jumlah<=0||!Number.isFinite(i.harga_satuan)||i.harga_satuan<0)) throw new Error('Material, jumlah dan harga pembelian wajib diisi dengan benar.');
 const tanggal=value(form,'tanggal');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)||!Number.isFinite(Date.parse(tanggal))||new Date(tanggal).toISOString().slice(0,10)!==tanggal||tanggal>today) throw new Error('Tanggal pembelian wajib valid dan tidak boleh di masa depan.');
 const destination=value(form,'destination');
 const [tujuan,holder]=destination.split(':');
 if(!['GUDANG','SPK'].includes(tujuan)||!holder) throw new Error('Pilih tujuan Gudang atau SPK.');
 return {tanggal,tujuan,id_pemasok:value(form,'id_pemasok'),id_lokasi:tujuan==='GUDANG'?holder:null,id_spk:tujuan==='SPK'?holder:null,no_nota:value(form,'no_nota'),keterangan:value(form,'keterangan')||null,items};
}
export async function saveMaterialPurchase(form:FormData) {
 let data;try {data=purchaseData(form);} catch(error) {redirectKavioFormError('/material',error instanceof Error?error.message:'Data pembelian tidak valid.',{focus:'purchase_entry',params:{tab:'pembelian'}});}
 await post('post_material_purchase_v2_atomic','MATERIAL_WAREHOUSE_WRITE',{p_data:data},'purchase_entry');
}
export async function amendMaterialPurchase(form:FormData) {
 const id=value(form,'id_transaksi'),hapus=value(form,'hapus')==='true',focus=`purchase_${hapus?'delete':'edit'}:${id}`;
 let data=null;if(!hapus) try {data=purchaseData(form);} catch(error) {redirectKavioFormError('/material',error instanceof Error?error.message:'Data pembelian tidak valid.',{focus,params:{tab:'pembelian'}});}
 await post('amend_material_purchase_atomic','MATERIAL_WAREHOUSE_WRITE',{p_id:id,p_alasan:value(form,'alasan'),p_pengganti:data},focus);
}
