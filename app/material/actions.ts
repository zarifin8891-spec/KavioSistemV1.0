'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { requireKavioAction } from '../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../lib/kavio-form-feedback';
import type { KavioAction } from '../../lib/kavio-permissions';

type MaterialRpc =
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
function positive(form: FormData, name: string) {
  const n = Number(value(form, name));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function supplierName(form: FormData, focus: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('master_pemasok').select('nama_pemasok').eq('id_pemasok', value(form, 'id_pemasok')).eq('status_aktif', true).single();
  if (error || !data) redirectKavioFormError('/material', 'Pilih pemasok aktif dari Data Master.', { form: 'material-entry', focus, params: {tab: transactionTab(focus)} });
  return data.nama_pemasok as string;
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

export async function postMaterialReceipt(form: FormData) {
  const idLokasi = value(form, 'id_lokasi');
  const idMaterial = value(form, 'id_material');
  const jumlah = positive(form, 'jumlah');
  const harga = Number(value(form, 'harga_satuan'));
  const saldoAwal = value(form, 'saldo_awal') === 'on';
  if (!idLokasi || !idMaterial || !jumlah || !Number.isFinite(harga) || harga < 0) redirectKavioFormError('/material', 'Lokasi, material, jumlah, dan harga satuan yang valid wajib diisi.', { form: 'material-entry', focus: 'receipt_material', params: {tab: transactionTab('receipt_material')} });
  if (!saldoAwal && (!value(form, 'id_pemasok') || !value(form, 'no_nota'))) redirectKavioFormError('/material', 'Pemasok dan nomor nota wajib diisi untuk penerimaan pembelian.', { form: 'material-entry', focus: 'receipt_supplier', params: {tab: transactionTab('receipt_supplier')} });
  const pemasok = saldoAwal ? null : await supplierName(form, 'receipt_supplier');
  await post('post_material_receipt_atomic', 'MATERIAL_WAREHOUSE_WRITE', {
    p_id_lokasi: idLokasi,
    p_items: [{ id_material: idMaterial, jumlah, harga_satuan: harga }],
    p_saldo_awal: saldoAwal,
    p_nama_pemasok: pemasok,
    p_no_nota: value(form, 'no_nota') || null,
    p_keterangan: value(form, 'keterangan') || null,
  }, 'receipt_material');
}

export async function createMaterialRequest(form: FormData) {
  const idSpk = value(form, 'id_spk');
  const idMaterial = value(form, 'id_material');
  const jumlah = positive(form, 'jumlah');
  const sumber = value(form, 'sumber_laporan');
  if (!idSpk || !idMaterial || !jumlah || !['MANDOR_PELAKSANA', 'GUDANG'].includes(sumber)) redirectKavioFormError('/material', 'SPK, sumber laporan, material, dan jumlah yang valid wajib diisi.', { form: 'material-entry', focus: 'request_spk', params: {tab: transactionTab('request_spk')} });
  await post('create_material_request_atomic', 'MATERIAL_REQUEST_WRITE', {
    p_id_spk: idSpk,
    p_sumber_laporan: sumber,
    p_items: [{ id_material: idMaterial, jumlah }],
    p_keterangan: value(form, 'keterangan') || null,
  }, 'request_spk');
}

export async function issueMaterialToSpk(form: FormData) {
  const idRequest = value(form, 'id_permintaan');
  const idLokasi = value(form, 'id_lokasi');
  const idMaterial = value(form, 'id_material');
  const jumlah = positive(form, 'jumlah');
  if (!idRequest || !idLokasi || !idMaterial || !jumlah) redirectKavioFormError('/material', 'Permintaan, gudang, material, dan jumlah wajib diisi.', { form: 'material-entry', focus: 'issue_request', params: {tab: transactionTab('issue_request')} });
  await post('fulfill_material_request_v2_atomic', 'MATERIAL_WAREHOUSE_WRITE', {
    p_id_permintaan: idRequest, p_id_lokasi: idLokasi, p_langsung_pakai:value(form,'langsung_pakai')!=='false',
    p_items: [{ id_material: idMaterial, jumlah }], p_keterangan: value(form, 'keterangan') || null,
  }, 'issue_request');
}

export async function postDirectMaterialUsage(form: FormData) {
  const idSpk = value(form, 'id_spk'); const idLokasi = value(form, 'id_lokasi');
  const idMaterial = value(form, 'id_material'); const jumlah = positive(form, 'jumlah');
  if (!idSpk || !idLokasi || !idMaterial || !jumlah) redirectKavioFormError('/material', 'SPK, gudang, material, dan jumlah wajib diisi.', { form: 'material-entry', focus: 'direct_spk', params: {tab: transactionTab('direct_spk')} });
  await post('post_material_direct_usage_atomic', 'MATERIAL_USE_WRITE', {
    p_id_spk: idSpk, p_id_lokasi: idLokasi,
    p_items: [{ id_material: idMaterial, jumlah }], p_keterangan: value(form, 'keterangan') || null,
  }, 'direct_spk');
}

export async function postSpkMaterialUsage(form: FormData) {
  const idSpk = value(form, 'id_spk'); const idMaterial = value(form, 'id_material'); const jumlah = positive(form, 'jumlah');
  if (!idSpk || !idMaterial || !jumlah) redirectKavioFormError('/material', 'SPK, material, dan jumlah wajib diisi.', { form: 'material-entry', focus: 'spk_usage_spk', params: {tab: transactionTab('spk_usage_spk')} });
  await post('post_spk_material_usage_atomic', 'MATERIAL_USE_WRITE', {
    p_id_spk: idSpk, p_items: [{ id_material: idMaterial, jumlah }], p_keterangan: value(form, 'keterangan') || null,
  }, 'spk_usage_spk');
}

export async function postSupplierDirectUsage(form: FormData) {
  const idSpk = value(form, 'id_spk'); const idMaterial = value(form, 'id_material');
  const jumlah = positive(form, 'jumlah'); const harga = Number(value(form, 'harga_satuan'));
  const pemasok = await supplierName(form, 'supplier_spk'); const nota = value(form, 'no_nota');
  if (!idSpk || !idMaterial || !jumlah || !pemasok || !nota || !Number.isFinite(harga) || harga < 0) redirectKavioFormError('/material', 'SPK, pemasok, nota, material, jumlah, dan harga yang valid wajib diisi.', { form: 'material-entry', focus: 'supplier_spk', params: {tab: transactionTab('supplier_spk')} });
  await post('post_supplier_direct_usage_atomic', 'MATERIAL_USE_WRITE', {
    p_id_spk: idSpk, p_nama_pemasok: pemasok, p_no_nota: nota,
    p_items: [{ id_material: idMaterial, jumlah, harga_satuan: harga }], p_keterangan: value(form, 'keterangan') || null,
  }, 'supplier_spk');
}

export async function reconcileSpkMaterial(form: FormData) {
  const idSpk = value(form, 'id_spk'); const idMaterial = value(form, 'id_material');
  const jumlah = positive(form, 'jumlah'); const tindakan = value(form, 'tindakan');
  if (!idSpk || !idMaterial || !jumlah || !tindakan) redirectKavioFormError('/material', 'SPK, material, jumlah, dan tindakan rekonsiliasi wajib diisi.', { form: 'material-entry', focus: 'reconcile_spk', params: {tab: transactionTab('reconcile_spk')} });
  await post('post_spk_material_reconciliation_atomic', 'MATERIAL_WAREHOUSE_WRITE', {
    p_id_spk: idSpk,
    p_items: [{ id_material: idMaterial, jumlah, tindakan,
      id_spk_tujuan: value(form, 'id_spk_tujuan') || null,
      id_lokasi_tujuan: value(form, 'id_lokasi_tujuan') || null,
      alasan: value(form, 'alasan') || null }],
    p_keterangan: value(form, 'keterangan') || null,
  }, 'reconcile_spk');
}

function purchaseData(form:FormData) {
 let items: {id_material:string;jumlah:number;harga_satuan:number}[]=[];
 try {items=JSON.parse(value(form,'items'));} catch { /* Validation below produces the form message. */ }
 if(!Array.isArray(items)||!items.length||items.some(i=>!i.id_material||!Number.isFinite(i.jumlah)||i.jumlah<=0||!Number.isFinite(i.harga_satuan)||i.harga_satuan<0)) throw new Error('Material, jumlah dan harga pembelian wajib diisi dengan benar.');
 return {tujuan:value(form,'tujuan'),id_pemasok:value(form,'id_pemasok'),id_lokasi:value(form,'id_lokasi')||null,id_spk:value(form,'id_spk')||null,no_nota:value(form,'no_nota'),keterangan:value(form,'keterangan')||null,items};
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
