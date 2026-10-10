"use server";

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { requireKavioAction } from '../../../lib/kavio-permissions-server';
import { redirectKavioFormError } from '../../../lib/kavio-form-feedback';

function text(value: FormDataEntryValue | null) {
  return String(value ?? '').trim();
}

async function saveCategory(formData:FormData,creating:boolean) {
 await requireKavioAction('MASTER_WRITE','/master/kategori-pekerjaan?error=');
 const idKategori=text(formData.get('id_kategori')),idTipe=text(formData.get('id_tipe'));
 const namaKategori=text(formData.get('nama_kategori')),urutan=Number(text(formData.get('urutan')));
 const rawWeight=text(formData.get('bobot_fraction')),bobot=Number(rawWeight);
 const fail=(message:string,focus='urutan'):never=>redirectKavioFormError('/master/kategori-pekerjaan',message,{form:creating?'master-kategori-create':undefined,focus,params:{tipe:idTipe,...(!creating?{edit:idKategori}:{})}});
 if(!idKategori||!namaKategori)fail('ID dan nama kategori wajib diisi',!idKategori?'id_kategori':'nama_kategori');
 if(!Number.isInteger(urutan)||urutan<1)fail('Urutan harus berupa bilangan bulat positif');
 if(!rawWeight||!Number.isFinite(bobot)||bobot<0||bobot>1)fail('Bobot harus berupa angka 0 sampai 100%','bobot_fraction');
 const supabase=await createClient();
 const {error}=await supabase.rpc('save_master_category_weight_atomic',{p_id_kategori:idKategori,p_nama:namaKategori,p_urutan:urutan,p_id_tipe:idTipe||null,p_bobot:bobot,p_create:creating});
 if(error)fail(error.message);
 for(const path of ['/master/kategori-pekerjaan','/master/template-progress','/master/perincian-pekerjaan','/master/spk'])revalidatePath(path);
 redirect(`/master/kategori-pekerjaan?tipe=${encodeURIComponent(idTipe)}&success=${encodeURIComponent(creating?'Kategori dan bobot berhasil ditambahkan':'Kategori dan bobot berhasil diperbarui')}`);
}
export async function createKategoriPekerjaan(formData:FormData){return saveCategory(formData,true);}
export async function updateKategoriPekerjaan(formData:FormData){return saveCategory(formData,false);}

export async function toggleKategoriPekerjaan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await requireKavioAction('MASTER_WRITE', '/master/kategori-pekerjaan?error=');

  const idKategori = text(formData.get('id_kategori'));
  const statusAktif = text(formData.get('status_aktif')) === 'true';

  if (!idKategori) redirectKavioFormError('/master/kategori-pekerjaan', 'ID kategori tidak valid');

  const { error } = await supabase
    .from('master_kategori_pekerjaan')
    .update({ status_aktif: !statusAktif })
    .eq('id_kategori', idKategori);

  if (error) {
    redirectKavioFormError('/master/kategori-pekerjaan', error.message);
  }

  revalidatePath('/master/kategori-pekerjaan');
  redirect('/master/kategori-pekerjaan');
}
