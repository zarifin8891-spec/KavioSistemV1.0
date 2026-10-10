begin;
select set_config('request.jwt.claim.sub','2d50291d-03e3-46a3-b3d8-c4550bc1bce7',true);
do $$
declare cat text:='TEST_CAT_'||substr(gen_random_uuid()::text,1,8); typ text:='TEST_CT_'||substr(gen_random_uuid()::text,1,8); seq integer; caught boolean:=false;
begin
 select coalesce(max(urutan),0)+1 into seq from public.master_kategori_pekerjaan;
 insert into public.master_tipe_rumah(id_tipe,nama_tipe,luas_tanah_m2,luas_bangunan_m2,status_aktif) values(typ,'TEST CATEGORY TYPE',72,36,true);
 perform public.save_master_category_weight_atomic(cat,'Test Category',seq,typ,.155,true);
 if (select bobot_standar from public.template_progress_tipe where id_tipe=typ and id_kategori=cat)<>.155 then raise exception 'FAILED create category weight'; end if;
 perform public.save_master_category_weight_atomic(cat,'Edited Category',seq,typ,.254,false);
 if (select bobot_standar from public.template_progress_tipe where id_tipe=typ and id_kategori=cat)<>.254 or (select nama_kategori from public.master_kategori_pekerjaan where id_kategori=cat)<>'Edited Category' then raise exception 'FAILED update category and weight'; end if;
 perform public.save_work_master_atomic(typ,1000000,jsonb_build_array(jsonb_build_object('id_kategori',cat,'bobot',1)),jsonb_build_array(jsonb_build_object('group_id',cat,'urutan',1,'nama_pekerjaan','Test Item','volume',10,'satuan','m2','bobot',1,'retensi',.05)),true);
 perform public.save_master_category_weight_atomic(cat,'Ready Name Edit',seq,typ,1,false);
 begin perform public.save_master_category_weight_atomic(cat,'SHOULD ROLLBACK',seq,typ,.5,false);
 exception when others then if sqlerrm like '%Bobot kategori belum sesuai%' then caught:=true; else raise; end if; end;
 if not caught or (select nama_kategori from public.master_kategori_pekerjaan where id_kategori=cat)<>'Ready Name Edit' or not(select perincian_siap from public.master_tipe_rumah where id_tipe=typ) or (select bobot_standar from public.template_progress_tipe where id_tipe=typ and id_kategori=cat)<>1 then raise exception 'FAILED published weight atomic rollback'; end if;
 if has_function_privilege('anon','public.save_master_category_weight_atomic(text,text,integer,text,numeric,boolean)','execute') then raise exception 'FAILED anonymous grant'; end if;
end $$;
rollback;
select 'PASS: create/edit weight, published name edit, atomic rollback, protected RPC' as category_tests;
