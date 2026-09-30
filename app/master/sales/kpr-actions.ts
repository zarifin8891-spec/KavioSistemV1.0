"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';

const STAGES = ['KELENGKAPAN_DATA','SURVEY_BANK','INTERVIEW','SP3K'] as const;
function text(v:FormDataEntryValue|null){return String(v??'').trim()}
export async function upsertKprProgress(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 await requireKavioAction('SALES_WRITE','/master/sales?error=');
 const idSales=text(formData.get('id_sales')); const tahap=text(formData.get('tahap')); const tanggal=text(formData.get('tanggal_update')); const keterangan=text(formData.get('keterangan'))||null;
 if(!idSales||!(STAGES as readonly string[]).includes(tahap)||!tanggal) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=Data%20update%20KPR%20tidak%20lengkap`);
 const {error}=await supabase.rpc('upsert_kpr_progress_atomic',{p_id_sales:idSales,p_tahap:tahap,p_tanggal_update:tanggal,p_keterangan:keterangan});
 if(error) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=${encodeURIComponent(error.message)}`);
 revalidatePath('/master/sales'); revalidatePath('/master/sales/detail');
 redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&success=Update%20KPR%20tersimpan`);
}
