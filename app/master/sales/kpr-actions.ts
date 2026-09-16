"use server";
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';

const STAGES = ['KELENGKAPAN_DATA','SURVEY_BANK','INTERVIEW','SP3K'] as const;
function text(v:FormDataEntryValue|null){return String(v??'').trim()}
export async function upsertKprProgress(formData:FormData){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const idSales=text(formData.get('id_sales')); const tahap=text(formData.get('tahap')); const tanggal=text(formData.get('tanggal_update')); const keterangan=text(formData.get('keterangan'))||null;
 if(!idSales||!(STAGES as readonly string[]).includes(tahap)||!tanggal) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=Data%20update%20KPR%20tidak%20lengkap`);
 const {error}=await supabase.from('sales_kpr_progress').upsert({id_sales:idSales,tahap,tanggal_update:tanggal,keterangan,input_by:user.id},{onConflict:'id_sales,tahap'});
 if(error) return redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&error=${encodeURIComponent(error.message)}`);
 revalidatePath('/master/sales'); revalidatePath('/master/sales/detail');
 redirect(`/master/sales/detail?id=${encodeURIComponent(idSales)}&success=Update%20KPR%20tersimpan`);
}
