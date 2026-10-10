'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '../../lib/supabase/server';
import {requireKavioAction} from '../../lib/kavio-permissions-server';
export async function saveCompanySettings(form:FormData) {
 await requireKavioAction('MASTER_WRITE');
 const name=String(form.get('nama_perusahaan')??'').trim();
 const fail=(message:string):never=>redirect(`/pengaturan?focus=company_name&error=${encodeURIComponent(message)}`);
 if(!name||name.length>200) fail('Nama perusahaan wajib diisi, maksimal 200 karakter.');
 const supabase=await createClient();
 const {data:previous,error:readError}=await supabase.from('company_settings').select('logo_data_url').eq('id',true).maybeSingle();
 if(readError) fail(readError.message);
 let logo=previous?.logo_data_url??null;
 if(form.get('hapus_logo')==='on') logo=null;
 const file=form.get('logo');
 if(file instanceof File&&file.size>0) {
  if(file.size>250000) fail('Logo maksimal 250 KB. Gunakan PNG atau JPG.');
  const bytes=Buffer.from(await file.arrayBuffer());
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!png&&!jpg) fail('Logo harus berupa gambar PNG atau JPG.');
  logo=`data:image/${png?'png':'jpeg'};base64,${bytes.toString('base64')}`;
 }
 const {error}=await supabase.from('company_settings').upsert({id:true,nama_perusahaan:name,logo_data_url:logo,updated_at:new Date().toISOString()});
 if(error) fail(error.message);
 revalidatePath('/pengaturan');revalidatePath('/penerimaan/kuitansi');
 redirect('/pengaturan?success=Pengaturan+perusahaan+berhasil+disimpan');
}
