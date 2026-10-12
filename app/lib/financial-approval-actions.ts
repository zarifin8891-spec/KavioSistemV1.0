'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '../../lib/supabase/server';
import {requireKavioAction} from '../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../lib/kavio-form-feedback';
const text=(f:FormData,n:string)=>String(f.get(n)??'').trim();
function target(kind:string,id:string):{path:string;params:Record<string,string>}{return kind==='PERJANJIAN'?{path:'/master/sales/detail',params:{id}}:{path:'/penerimaan',params:{tab:'pembatalan'}};}
function failure(kind:string,id:string,message:string,focus:string):never {const t=target(kind,id);return redirectKavioFormError(t.path,message,{focus,params:t.params});}
function done(kind:string,id:string,message:string):never {for(const p of ['/master/sales','/master/sales/detail','/penerimaan','/dashboard','/laporan'])revalidatePath(p);const t=target(kind,id);redirect(t.path+'?'+new URLSearchParams({...t.params,success:message}).toString());}
export async function submitFinancialProposal(form:FormData){
 const kind=text(form,'jenis'),id=text(form,'id_sales'),focus=text(form,'focus');
 if(!['PERJANJIAN','PEMBATALAN'].includes(kind))failure(kind,id,'Jenis pengajuan tidak valid.',focus);
 await requireKavioAction(kind==='PERJANJIAN'?'SALES_WRITE':'PAYMENT_RECEIPT_WRITE');
 const keys=kind==='PERJANJIAN'?['harga_jual','biaya_penambahan_bangunan','biaya_kelebihan_tanah','biaya_hook','biaya_notaris','biaya_akad','biaya_lainnya']:['nominal_dikembalikan','nominal_ditahan'];
 const data:Record<string,string|number|null>=Object.fromEntries(keys.map(key=>[key,Number(text(form,key))]));
 if(kind==='PERJANJIAN')Object.assign(data,{jenis_pembayaran:text(form,'jenis_pembayaran'),id_bank:text(form,'id_bank')||null,tenor_bulan:Number(text(form,'tenor_bulan')),pola_pelunasan:text(form,'pola_pelunasan')||null});
 else data.keputusan=text(form,'keputusan');
 const db=await createClient();const {error}=await db.rpc('submit_sales_financial_approval',{p_id_sales:id,p_jenis:kind,p_data:data,p_alasan:text(form,'alasan')});
 if(error)failure(kind,id,error.message,focus);
 done(kind,id,'Pengajuan tersimpan. Nilai yang berlaku menunggu persetujuan Direktur.');
}
export async function transitionFinancialProposal(form:FormData){
 const kind=text(form,'jenis'),id=text(form,'id_sales'),action=text(form,'aksi'),focus=text(form,'focus');
 await requireKavioAction(action==='BATAL'?(kind==='PERJANJIAN'?'SALES_WRITE':'PAYMENT_RECEIPT_WRITE'):'FINANCIAL_APPROVE');
 const db=await createClient();const {error}=await db.rpc('transition_sales_financial_approval',{p_id_pengajuan:text(form,'id_pengajuan'),p_aksi:action,p_catatan:text(form,'catatan')||null});
 if(error)failure(kind,id,error.message,focus);
 done(kind,id,action==='SETUJUI'?'Pengajuan disetujui Direktur dan keputusan berlaku.':action==='TOLAK'?'Pengajuan ditolak.':'Pengajuan dibatalkan.');
}
export async function postRefundPayment(form:FormData){
 await requireKavioAction('PAYMENT_RECEIPT_WRITE');
 const id=text(form,'id_sales'),focus=text(form,'focus'),db=await createClient();
 const {error}=await db.rpc('post_sales_refund_payment_atomic',{p_data:{id_sales:id,id_pengajuan:text(form,'id_pengajuan'),request_key:text(form,'request_key'),tanggal:text(form,'tanggal'),id_bank:text(form,'id_bank'),nominal:Number(text(form,'nominal')),no_referensi:text(form,'no_referensi')||null,keterangan:text(form,'keterangan')||null}});
 if(error)failure('PEMBATALAN',id,error.message,focus);
 done('PEMBATALAN',id,'Pengembalian pembayaran tersimpan di riwayat refund.');
}

