'use server';
import {createClient} from '../../../lib/supabase/server';
import {requireKavioAction} from '../../../lib/kavio-permissions-server';
import {redirectKavioFormError} from '../../../lib/kavio-form-feedback';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
const value=(f:FormData,k:string)=>String(f.get(k)??'').trim();
const path='/laporan';
function fail(message:string,focus:string):never{return redirectKavioFormError(path,message,{focus,params:{jenis:'upah'}});}
function done():never{revalidatePath('/laporan');redirect('/laporan?jenis=upah&success=Transaksi+upah+berhasil+disimpan');}
export async function createWagePayment(form:FormData){
 await requireKavioAction('WAGE_PAYMENT_WRITE','/laporan?jenis=upah&error=Akses+ditolak');
 let data;try{data={request_key:value(form,'request_key'),jenis:value(form,'jenis'),tanggal:value(form,'tanggal'),id_mandor:value(form,'id_mandor'),id_bank:value(form,'id_bank'),keterangan:value(form,'keterangan'),items:JSON.parse(value(form,'items'))};}catch{fail('Rincian pembayaran tidak valid.','wage_create');}
 const db=await createClient();const {error}=await db.rpc('create_wage_payment_atomic',{p_data:data});if(error)fail(error.message,'wage_create');done();
}
export async function transitionWagePayment(form:FormData){
 const action=value(form,'aksi');await requireKavioAction(action==='SETUJUI'?'RETENTION_APPROVE':'WAGE_PAYMENT_WRITE','/laporan?jenis=upah&error=Akses+ditolak');
 const db=await createClient();const {error}=await db.rpc('transition_wage_payment_atomic',{p_id:value(form,'id'),p_action:action,p_tanggal:value(form,'tanggal')||null,p_id_bank:value(form,'id_bank')||null,p_alasan:value(form,'alasan')||null});if(error)fail(error.message,`wage_${action.toLowerCase()}:${value(form,'id')}`);done();
}
